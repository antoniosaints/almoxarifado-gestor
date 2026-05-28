import { UserRole, type ManagerBillingStatus, type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { verifyAccessToken } from "../lib/auth.js";
import { prisma as defaultPrisma } from "../lib/prisma.js";

type RealtimeClient = {
  socket: Duplex;
  userId: string;
};

type ManagerBillingRealtimeEvent = {
  billingId: string;
  paymentId?: string | null;
  paymentStatus?: string | null;
  status: ManagerBillingStatus;
  subscriberId: string;
  type: "manager.billing.updated";
  updatedAt: string;
};

const clients = new Set<RealtimeClient>();
const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function closeHttp(socket: Duplex, status: number, message: string) {
  socket.write(
    [
      `HTTP/1.1 ${status} ${message}`,
      "Connection: close",
      "Content-Length: 0",
      "",
      "",
    ].join("\r\n"),
  );
  socket.destroy();
}

function websocketAcceptKey(key: string) {
  return createHash("sha1")
    .update(`${key}${websocketGuid}`)
    .digest("base64");
}

function sendFrame(socket: Duplex, payload: string, opcode = 0x1) {
  if (socket.destroyed) {
    return;
  }

  const payloadBuffer = Buffer.from(payload);
  const length = payloadBuffer.length;
  let header: Buffer;

  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  socket.write(Buffer.concat([header, payloadBuffer]));
}

function sendJson(socket: Duplex, payload: unknown) {
  sendFrame(socket, JSON.stringify(payload));
}

function removeClient(client: RealtimeClient) {
  clients.delete(client);
}

function handleClientFrame(client: RealtimeClient, frame: Buffer) {
  const opcode = frame[0] ? frame[0] & 0x0f : 0;

  if (opcode === 0x8) {
    sendFrame(client.socket, "", 0x8);
    client.socket.end();
    removeClient(client);
    return;
  }

  if (opcode === 0x9) {
    sendFrame(client.socket, "", 0xA);
  }
}

async function authenticateUpgrade(request: IncomingMessage) {
  const host = request.headers.host ?? "127.0.0.1";
  const url = new URL(request.url ?? "/", `http://${host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    return null;
  }

  const tokenUser = verifyAccessToken(token);

  if (tokenUser.role !== UserRole.ADMIN) {
    return null;
  }

  const user = await defaultPrisma.user.findUnique({
    select: { active: true, id: true, role: true },
    where: { id: tokenUser.id },
  });

  if (!user?.active || user.role !== UserRole.ADMIN) {
    return null;
  }

  return tokenUser;
}

export function installManagerRealtime(server: Server) {
  server.on("upgrade", async (request, socket) => {
    const host = request.headers.host ?? "127.0.0.1";
    const url = new URL(request.url ?? "/", `http://${host}`);

    if (url.pathname !== "/manager/realtime") {
      closeHttp(socket, 404, "Not Found");
      return;
    }

    const key = firstHeaderValue(request.headers["sec-websocket-key"]);
    const upgrade = firstHeaderValue(request.headers.upgrade)?.toLowerCase();

    if (upgrade !== "websocket" || !key) {
      closeHttp(socket, 400, "Bad Request");
      return;
    }

    try {
      const user = await authenticateUpgrade(request);

      if (!user) {
        closeHttp(socket, 401, "Unauthorized");
        return;
      }

      socket.write(
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${websocketAcceptKey(key)}`,
          "",
          "",
        ].join("\r\n"),
      );

      const client = { socket, userId: user.id };
      clients.add(client);

      socket.on("data", (frame) => handleClientFrame(client, frame));
      socket.on("close", () => removeClient(client));
      socket.on("error", () => removeClient(client));

      sendJson(socket, {
        type: "manager.realtime.connected",
      });
    } catch {
      closeHttp(socket, 401, "Unauthorized");
    }
  });
}

export function broadcastManagerBillingUpdate(event: ManagerBillingRealtimeEvent) {
  const payload = JSON.stringify(event);

  for (const client of clients) {
    if (client.socket.destroyed) {
      removeClient(client);
      continue;
    }

    sendFrame(client.socket, payload);
  }
}

export async function notifyManagerBillingChanged(
  prisma: PrismaClient,
  billingId: string,
) {
  const billing = await prisma.managerBilling.findUnique({
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    where: { id: billingId },
  });

  if (!billing) {
    return;
  }

  const payment = billing.payments[0];

  broadcastManagerBillingUpdate({
    billingId: billing.id,
    paymentId: payment?.id ?? null,
    paymentStatus: payment?.status ?? null,
    status: billing.status,
    subscriberId: billing.subscriberId,
    type: "manager.billing.updated",
    updatedAt: new Date().toISOString(),
  });
}
