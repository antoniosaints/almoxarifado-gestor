import { UserRole } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  extractOfficeTemplateVariables,
  idParam,
  officeTemplateInput,
} from "../validators/inputs.js";

export const officeTemplateRoutes = Router();

officeTemplateRoutes.use(requireRole(UserRole.ADMIN));

function parseTemplate(template: { variables: string }) {
  return {
    ...template,
    variables: JSON.parse(template.variables) as string[],
  };
}

function templateData(input: ReturnType<typeof officeTemplateInput.parse>) {
  try {
    return {
      ...input,
      variables: JSON.stringify(
        extractOfficeTemplateVariables(
          input.subject,
          input.headerText,
          input.contentHtml,
          input.footerText,
        ),
      ),
    };
  } catch (error) {
    throw new AppError(
      400,
      error instanceof Error ? error.message : "Variavel de oficio invalida.",
    );
  }
}

officeTemplateRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    const templates = await prisma.officeLetterTemplate.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    response.json(templates.map(parseTemplate));
  }),
);

officeTemplateRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = officeTemplateInput.parse(request.body);
    const data = templateData(input);
    const template = await prisma.$transaction(async (transaction) => {
      if (input.active) {
        await transaction.officeLetterTemplate.updateMany({
          data: { active: false },
          where: { active: true },
        });
      }

      return transaction.officeLetterTemplate.create({
        data,
      });
    });

    response.status(201).json(parseTemplate(template));
  }),
);

officeTemplateRoutes.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = officeTemplateInput.parse(request.body);
    const data = templateData(input);
    const template = await prisma.$transaction(async (transaction) => {
      if (input.active) {
        await transaction.officeLetterTemplate.updateMany({
          data: { active: false },
          where: {
            active: true,
            id: { not: id },
          },
        });
      }

      return transaction.officeLetterTemplate.update({
        data,
        where: { id },
      });
    });

    response.json(parseTemplate(template));
  }),
);

officeTemplateRoutes.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    await prisma.officeLetterTemplate.delete({ where: { id } });
    response.status(204).send();
  }),
);
