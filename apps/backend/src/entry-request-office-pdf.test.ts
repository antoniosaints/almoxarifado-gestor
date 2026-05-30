import { UserRole } from "@prisma/client";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { createAccessToken } from "./lib/auth.js";
import { prisma } from "./lib/prisma.js";
import { createBaseFixture, resetDatabase } from "./test/database.js";

function authorizationFor(user: {
  email: string;
  id: string;
  name: string;
  role: UserRole;
}) {
  return `Bearer ${createAccessToken(user)}`;
}

function tinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}

describe("entry request office letter rendering", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
    rmSync(path.join(process.cwd(), "uploads", "office-template-images"), {
      force: true,
      recursive: true,
    });
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    rmSync(path.join(process.cwd(), "uploads", "office-template-images"), {
      force: true,
      recursive: true,
    });
    await prisma.$disconnect();
  });

  it("renders reusable header/footer config and leaves PDF export to the frontend", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      data: { role: UserRole.ADMIN },
      where: { id: user.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const auth = authorizationFor(admin);
    const imageUpload = await request(app)
      .post("/uploads/office-template-images")
      .set("Authorization", auth)
      .set("Content-Type", "image/png")
      .send(tinyPngBuffer());

    expect(imageUpload.status).toBe(201);
    expect(existsSync(path.join(process.cwd(), "uploads"))).toBe(true);

    const template = await request(app)
      .post("/office-templates")
      .set("Authorization", auth)
      .send({
        contentHtml:
          "<div style=\"font-family:'Times New Roman',serif;\"><p><strong>OFICIO {{oficio_numero_ano}}</strong></p><p>{{itens_solicitados_html}}</p></div>",
        footerText: "Documento {{oficio_numero_ano}}",
        headerAlignment: "CENTER",
        headerImageUrl: imageUpload.body.url,
        headerText: "{{secretaria_nome}}\n{{almoxarifado_nome}}",
        name: "Solicitacao com cabecalho",
        subject: "Solicitacao",
      });

    expect(template.status).toBe(201);
    expect(template.body).toMatchObject({
      footerText: "Documento {{oficio_numero_ano}}",
      headerAlignment: "CENTER",
      headerImageUrl: imageUpload.body.url,
      headerText: "{{secretaria_nome}}\n{{almoxarifado_nome}}",
    });

    const createdRequest = await request(app)
      .post("/entry-requests")
      .set("Authorization", auth)
      .send({
        movementDate: "2026-05-23T12:00:00.000Z",
        productId: product.id,
        quantity: 4,
        warehouseId: warehouse.id,
      });

    expect(createdRequest.status).toBe(201);

    const office = await request(app)
      .get(`/entry-requests/${createdRequest.body.id}/office-letter`)
      .set("Authorization", auth);

    expect(office.status).toBe(200);
    expect(office.body.contentHtml).toContain(
      "style=\"font-family:'Times New Roman',serif;\"",
    );
    expect(office.body.documentHtml).toContain("Almoxarifado da Saude");
    expect(office.body.documentHtml).toContain("Documento 001/2026");
    expect(office.body.documentHtml).toContain("Papel A4 - 4 Unidade.");
    expect(office.body.documentHtml).toContain(imageUpload.body.url);

    const pdf = await request(app)
      .get(`/entry-requests/${createdRequest.body.id}/office-letter/pdf`)
      .set("Authorization", auth);

    expect(pdf.status).toBe(404);
    expect(pdf.headers["content-type"]).not.toContain("application/pdf");
  });
});
