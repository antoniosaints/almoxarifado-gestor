import { createHmac, createHash } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../lib/errors.js";

export const acceptedImageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

const extensionByMimeType: Record<(typeof acceptedImageMimeTypes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

type UploadMimeType = (typeof acceptedImageMimeTypes)[number];

type UploadAssetInput = {
  buffer: Buffer;
  contentType: string;
  key: string;
  namespace: string;
};

type UploadAssetResult = {
  driver: "local" | "s3";
  key: string;
  url: string;
};

type S3Config = {
  accessKeyId: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle: boolean;
  publicUrl?: string;
  region: string;
  secretAccessKey: string;
};

const defaultMaxUploadBytes = 1024 * 1024;
const emptyPayloadHash = createHash("sha256").update("").digest("hex");

export function getLocalUploadRoot() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
}

export function getUploadMaxBytes() {
  const configured = Number(process.env.UPLOAD_MAX_BYTES);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : defaultMaxUploadBytes;
}

export function normalizeUploadContentType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export async function storeUploadAsset(input: UploadAssetInput): Promise<UploadAssetResult> {
  const contentType = normalizeUploadContentType(input.contentType);

  if (!isAcceptedImageMimeType(contentType)) {
    throw new AppError(400, "Use PNG, JPG, WEBP ou SVG.");
  }

  if (!input.buffer.length) {
    throw new AppError(400, "Selecione um arquivo para upload.");
  }

  if (input.buffer.length > getUploadMaxBytes()) {
    throw new AppError(413, "Arquivo muito grande. Envie uma imagem de ate 1 MB.");
  }

  assertSafeStoragePart(input.namespace, "namespace");
  assertSafeStoragePart(input.key, "key");

  const extension = extensionByMimeType[contentType];
  const objectKey = `${input.namespace}/${input.key}.${extension}`;

  if (shouldUseS3()) {
    return storeS3Asset({
      buffer: input.buffer,
      contentType,
      extension,
      objectKey,
      siblingKeys: siblingObjectKeys(input.namespace, input.key, extension),
    });
  }

  return storeLocalAsset({
    buffer: input.buffer,
    contentType,
    extension,
    key: input.key,
    namespace: input.namespace,
    objectKey,
  });
}

function isAcceptedImageMimeType(value: string): value is UploadMimeType {
  return acceptedImageMimeTypes.includes(value as UploadMimeType);
}

function assertSafeStoragePart(value: string, name: string) {
  if (!/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/i.test(value)) {
    throw new AppError(400, `Identificador de upload inválido: ${name}.`);
  }
}

async function storeLocalAsset({
  buffer,
  extension,
  key,
  namespace,
  objectKey,
}: {
  buffer: Buffer;
  contentType: UploadMimeType;
  extension: string;
  key: string;
  namespace: string;
  objectKey: string;
}): Promise<UploadAssetResult> {
  const uploadRoot = getLocalUploadRoot();
  const namespaceRoot = path.join(uploadRoot, namespace);
  const targetPath = path.join(namespaceRoot, `${key}.${extension}`);
  const tempPath = `${targetPath}.${Date.now()}.tmp`;

  await mkdir(namespaceRoot, { recursive: true });
  await writeFile(tempPath, buffer);
  await rename(tempPath, targetPath);
  await deleteLocalSiblings(namespaceRoot, key, extension);

  return {
    driver: "local",
    key: objectKey,
    url: withVersion(joinPublicUrl(localUploadPublicBase(), `/${objectKey}`)),
  };
}

async function deleteLocalSiblings(namespaceRoot: string, key: string, keepExtension: string) {
  await Promise.all(
    uniqueExtensions()
      .filter((extension) => extension !== keepExtension)
      .map(async (extension) => {
        try {
          await unlink(path.join(namespaceRoot, `${key}.${extension}`));
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }
      }),
  );
}

function localUploadPublicBase() {
  return process.env.UPLOAD_PUBLIC_URL?.trim() || "/uploads";
}

function joinPublicUrl(base: string, objectPath: string) {
  return `${base.replace(/\/$/, "")}${objectPath.startsWith("/") ? objectPath : `/${objectPath}`}`;
}

function withVersion(url: string) {
  return `${url}?v=${Date.now()}`;
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function uniqueExtensions() {
  return Array.from(new Set(Object.values(extensionByMimeType)));
}

function shouldUseS3() {
  return Boolean(resolveS3Config());
}

function resolveS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET ?? process.env.AWS_S3_BUCKET;
  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accessKeyId,
    bucket,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE === "true" || Boolean(process.env.S3_ENDPOINT),
    publicUrl: process.env.S3_PUBLIC_URL,
    region,
    secretAccessKey,
  };
}

async function storeS3Asset({
  buffer,
  contentType,
  extension,
  objectKey,
  siblingKeys,
}: {
  buffer: Buffer;
  contentType: UploadMimeType;
  extension: string;
  objectKey: string;
  siblingKeys: string[];
}): Promise<UploadAssetResult> {
  const config = resolveS3Config();

  if (!config) {
    throw new AppError(500, "Storage S3 não configurado.");
  }

  await signedS3Request(config, {
    body: buffer,
    contentType,
    key: objectKey,
    method: "PUT",
  });

  await Promise.all(
    siblingKeys.map((key) =>
      signedS3Request(config, {
        key,
        method: "DELETE",
      }).catch(() => undefined),
    ),
  );

  return {
    driver: "s3",
    key: objectKey,
    url: withVersion(publicS3Url(config, objectKey)),
  };
}

function siblingObjectKeys(namespace: string, key: string, keepExtension: string) {
  return uniqueExtensions()
    .filter((extension) => extension !== keepExtension)
    .map((extension) => `${namespace}/${key}.${extension}`);
}

async function signedS3Request(
  config: S3Config,
  request: {
    body?: Buffer;
    contentType?: UploadMimeType;
    key: string;
    method: "DELETE" | "PUT";
  },
) {
  const url = s3ObjectUrl(config, request.key);
  const payloadHash = request.body
    ? createHash("sha256").update(request.body).digest("hex")
    : emptyPayloadHash;
  const amzDate = s3AmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  if (request.contentType) {
    headers["content-type"] = request.contentType;
  }

  const authorization = s3Authorization({
    config,
    dateStamp,
    headers,
    method: request.method,
    pathname: url.pathname,
    payloadHash,
  });

  const response = await fetch(url, {
    body: request.body ? bufferToArrayBuffer(request.body) : undefined,
    headers: {
      ...headers,
      Authorization: authorization,
    },
    method: request.method,
  });

  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => "");
    throw new AppError(
      502,
      `Falha ao enviar arquivo para o S3.${details ? ` ${details.slice(0, 120)}` : ""}`,
    );
  }
}

function s3Authorization({
  config,
  dateStamp,
  headers,
  method,
  pathname,
  payloadHash,
}: {
  config: S3Config;
  dateStamp: string;
  headers: Record<string, string>;
  method: "DELETE" | "PUT";
  pathname: string;
  payloadHash: string;
}) {
  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders
    .map((header) => `${header}:${headers[header].trim()}\n`)
    .join("");
  const signedHeaders = sortedHeaders.join(";");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const canonicalRequest = [
    method,
    pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    headers["x-amz-date"],
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signingKey = hmac(
    hmac(
      hmac(
        hmac(Buffer.from(`AWS4${config.secretAccessKey}`, "utf8"), dateStamp),
        config.region,
      ),
      "s3",
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return [
    "AWS4-HMAC-SHA256",
    `Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(" ");
}

function hmac(key: Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function bufferToArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);

  return arrayBuffer;
}

function s3AmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function s3ObjectUrl(config: S3Config, key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");

  if (config.endpoint) {
    const endpoint = new URL(config.endpoint);

    if (config.forcePathStyle) {
      endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/${config.bucket}/${encodedKey}`;
    } else {
      endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
      endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/${encodedKey}`;
    }

    return endpoint;
  }

  return new URL(
    `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`,
  );
}

function publicS3Url(config: S3Config, key: string) {
  const publicBase = config.publicUrl?.trim();

  if (publicBase) {
    return joinPublicUrl(publicBase, `/${key}`);
  }

  return s3ObjectUrl(config, key).toString();
}
