import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getPrivateObject, getStorageBackend, putPrivateObject } from "@/lib/r2";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".pdf"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const privateUploadDir =
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), ".private_uploads");

function safeBasename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function validateUpload(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.has(ext)) {
    throw new Error("Unsupported file type");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File too large");
  }
}

export async function savePrivateFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const uniqueName = `${Date.now()}_${crypto.randomUUID()}_${safeBasename(file.name)}`;

  if (getStorageBackend() === "r2") {
    const key = `private/${uniqueName}`;
    return putPrivateObject(key, buffer, file.type);
  }

  await fs.mkdir(privateUploadDir, { recursive: true });
  const fileKey = path.join(privateUploadDir, uniqueName);
  await fs.writeFile(fileKey, buffer);
  return fileKey;
}

export async function readPrivateFile(fileKey: string) {
  if (fileKey.startsWith("r2://")) {
    return getPrivateObject(fileKey);
  }

  const resolved = path.resolve(fileKey);
  const base = path.resolve(privateUploadDir);

  if (!resolved.startsWith(base)) {
    throw new Error("Invalid file key");
  }

  return fs.readFile(resolved);
}
