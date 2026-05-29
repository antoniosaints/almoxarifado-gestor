import { UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import express, { Router } from "express";
import { AppError } from "../lib/errors.js";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  uploadSystemSettingsAsset,
} from "../services/settings-service.js";
import { uploadSiteAsset } from "../services/site-service.js";
import {
  acceptedImageMimeTypes,
  getUploadMaxBytes,
  storeUploadAsset,
} from "../services/upload-service.js";

export const uploadRoutes = Router();

const rawImageUpload = express.raw({
  limit: getUploadMaxBytes(),
  type: [...acceptedImageMimeTypes],
});

uploadRoutes.post(
  "/office-template-images",
  requireRole(UserRole.ADMIN),
  rawImageUpload,
  asyncHandler(async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(400, "Selecione uma imagem PNG, JPG, WEBP ou SVG.");
    }

    const result = await storeUploadAsset({
      buffer: request.body,
      contentType: request.get("content-type") ?? "",
      key: `office-template-image-${randomBytes(6).toString("hex")}`,
      namespace: "office-template-images",
    });

    response.status(201).json(result);
  }),
);

uploadRoutes.post(
  "/settings/:slot",
  requireRole(UserRole.ADMIN),
  rawImageUpload,
  asyncHandler(async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(400, "Selecione uma imagem PNG, JPG, WEBP ou SVG.");
    }

    const result = await uploadSystemSettingsAsset(prisma, {
      buffer: request.body,
      contentType: request.get("content-type") ?? "",
      slot: String(request.params.slot ?? ""),
    });

    response.status(201).json(result);
  }),
);

uploadRoutes.post(
  "/site/:slot",
  requireRole(UserRole.ADMIN),
  rawImageUpload,
  asyncHandler(async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(400, "Selecione uma imagem PNG, JPG, WEBP ou SVG.");
    }

    const result = await uploadSiteAsset(prisma, {
      buffer: request.body,
      contentType: request.get("content-type") ?? "",
      slot: String(request.params.slot ?? ""),
    });

    response.status(201).json(result);
  }),
);
