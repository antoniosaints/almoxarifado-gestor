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

  it("renders footer/layout config in the body and leaves PDF export to the frontend", async () => {
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
    // Layout do modelo (margens/fonte padrão) aplicado no wrapper A4.
    expect(office.body.documentHtml).toContain("padding:25mm 20mm 20mm 20mm");
    expect(office.body.documentHtml).toContain(
      "font-family:Arial, Helvetica, sans-serif",
    );
    // Rodapé do modelo é renderizado e os itens vêm do corpo.
    expect(office.body.documentHtml).toContain("Documento 001/2026");
    expect(office.body.documentHtml).toContain("Papel A4 - 4 Unidade.");
    // O cabeçalho automático do almoxarifado deixou de existir ("tudo no corpo").
    expect(office.body.documentHtml).not.toContain("data-office-letter-header");
    expect(office.body.documentHtml).not.toContain(imageUpload.body.url);

    const pdf = await request(app)
      .get(`/entry-requests/${createdRequest.body.id}/office-letter/pdf`)
      .set("Authorization", auth);

    expect(pdf.status).toBe(404);
    expect(pdf.headers["content-type"]).not.toContain("application/pdf");
  });

  it("previews a template applying custom margins, font and footer identically", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      data: { role: UserRole.ADMIN },
      where: { id: user.id },
    });
    const auth = authorizationFor(admin);

    const preview = await request(app)
      .post("/office-templates/preview")
      .set("Authorization", auth)
      .send({
        contentHtml: "<p>Corpo</p>{{itens_solicitados_tabela}}",
        fontFamily: "Georgia",
        fontSize: 14,
        footerText: "Rodapé {{ano_oficio}}",
        marginBottom: 10,
        marginLeft: 18,
        marginRight: 15,
        marginTop: 30,
      });

    expect(preview.status).toBe(200);
    expect(preview.body.documentHtml).toContain("padding:30mm 15mm 10mm 18mm");
    // Regressão: a geometria do papel NÃO pode voltar para o style inline, senão
    // brigaria com o CSS de impressão e geraria uma página em branco extra.
    expect(preview.body.documentHtml).not.toContain("min-height:297mm");
    expect(preview.body.documentHtml).not.toContain("width:210mm");
    expect(preview.body.documentHtml).toContain(
      "font-family:Georgia, 'Times New Roman', serif",
    );
    expect(preview.body.documentHtml).toContain("font-size:14pt");
    // Variável de tabela renderiza como HTML real (não escapada).
    expect(preview.body.documentHtml).toContain("<table");
    expect(preview.body.documentHtml).not.toContain("&lt;table");
    // Rodapé com variável de exemplo resolvida, e sem cabeçalho automático.
    expect(preview.body.documentHtml).toContain("Rodapé 2026");
    expect(preview.body.documentHtml).toContain("data-office-letter-footer");
    expect(preview.body.documentHtml).not.toContain("data-office-letter-header");
  });
});
