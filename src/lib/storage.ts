import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function uploadThumbnail(file: File) {
  const ext = MIME_EXT[file.type];
  if (!ext) {
    throw new Error("지원하지 않는 이미지 형식입니다. png/jpg/webp만 업로드할 수 있습니다.");
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("썸네일은 10MB 이하만 업로드할 수 있습니다.");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "projects");
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  const filepath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return {
    url: `/uploads/projects/${filename}`,
    filename,
  };
}

const WORKSPACE_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const BOARD_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

export async function uploadWorkspaceFile(projectId: string, file: File) {
  if (!WORKSPACE_ALLOWED_MIME.has(file.type)) {
    throw new Error("허용되지 않는 파일 형식입니다. (이미지/pdf/docx/xlsx/pptx)");
  }

  const maxBytes = 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("파일은 20MB 이하만 업로드할 수 있습니다.");
  }

  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const uploadDir = path.join(process.cwd(), "public", "uploads", "workspace", safeProject);
  await mkdir(uploadDir, { recursive: true });

  const original = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${randomUUID()}-${original}`;
  const filepath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return {
    fileUrl: `/uploads/workspace/${safeProject}/${filename}`,
    fileName: file.name || original,
    mimeType: file.type,
    size: file.size,
  };
}

export async function uploadBoardAttachment(channelSlug: string, file: File) {
  if (!BOARD_ALLOWED_MIME.has(file.type)) {
    throw new Error("허용되지 않는 파일 형식입니다. (이미지/pdf/doc/docx/xls/xlsx/ppt/pptx/txt)");
  }

  const maxBytes = 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("첨부파일은 20MB 이하만 업로드할 수 있습니다.");
  }

  const safeChannel = channelSlug.replace(/[^a-zA-Z0-9_-]/g, "_");
  const uploadDir = path.join(process.cwd(), "public", "uploads", "boards", safeChannel);
  await mkdir(uploadDir, { recursive: true });

  const original = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${randomUUID()}-${original}`;
  const filepath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return {
    fileUrl: `/uploads/boards/${safeChannel}/${filename}`,
    fileName: file.name || original,
    mimeType: file.type,
    size: file.size,
  };
}
