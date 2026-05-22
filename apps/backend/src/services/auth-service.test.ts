import { UserRole } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../test/database.js";
import { hashPassword, loginWithPassword } from "./auth-service.js";

describe("auth service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("authenticates active users by password", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Administrador",
        email: "admin@prefeitura.local",
        passwordHash: await hashPassword("senha123"),
        role: UserRole.ADMIN,
        active: true,
      },
    });

    const session = await loginWithPassword(
      prisma,
      user.email,
      "senha123",
    );

    expect(session.token).toEqual(expect.any(String));
    expect(session.user).toMatchObject({
      email: user.email,
      role: UserRole.ADMIN,
    });
  });
});
