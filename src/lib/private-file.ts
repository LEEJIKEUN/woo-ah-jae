import crypto from "node:crypto";
import { getStorageBackend, putPrivateObject, getPrivateObject, deletePrivateObject } from "@/lib/r2";

/**
 * 비공개 업로드(멘토링 보고서·채팅 첨부·강의 콘텐츠 파일) 저장 추상화.
 * STORAGE_BACKEND=r2 이면 실제 바이트를 Cloudflare R2(비공개 버킷)에 저장하고 DB엔 키만 남긴다.
 * R2 미설정이면 base64 dataUrl 을 그대로 DB에 인라인 보관(로컬/폴백) — 기존 동작과 동일.
 * 서빙은 우리 라우트가 권한 확인 후 바이트를 내려준다.
 */
export type StoredRef = { key: string | null; data: string | null };

export function r2Enabled() {
  return getStorageBackend() === "r2";
}

/** dataUrl(data:mime;base64,....) → { mime, buffer }. */
export function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return null;
  const header = dataUrl.slice(5, comma); // 예: "image/png;base64"
  const data = dataUrl.slice(comma + 1);
  const isBase64 = /;base64$/i.test(header);
  const mime = header.replace(/;base64$/i, "") || "application/octet-stream";
  const buffer = isBase64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8");
  return { mime, buffer };
}

function safeName(name: string) {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/** base64 dataUrl 을 저장. R2 사용 시 R2 키(r2://...)를, 아니면 dataUrl 을 그대로 반환. */
export async function storeUploadDataUrl(prefix: string, name: string, mime: string, dataUrl: string): Promise<StoredRef> {
  if (r2Enabled()) {
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) throw new Error("invalid dataUrl");
    const key = await putPrivateObject(`${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName(name)}`, decoded.buffer, mime || decoded.mime);
    return { key, data: null };
  }
  return { key: null, data: dataUrl };
}

/** R2 오브젝트 삭제(있을 때만·best-effort). key 는 raw 키 또는 r2:// 접두 키 모두 허용. */
export async function deletePrivateKey(key: string | null | undefined) {
  if (!key || !r2Enabled()) return;
  try {
    await deletePrivateObject(key.startsWith("r2://") ? key.slice("r2://".length) : key);
  } catch {
    /* 파일 삭제 실패는 무시(고아 파일은 나중에 정리) */
  }
}

/** 저장된 파일 바이트 읽기(R2 키 또는 인라인 base64). */
export async function readUpload(ref: { key?: string | null; data?: string | null }): Promise<Buffer | null> {
  if (ref.key) return getPrivateObject(ref.key);
  if (ref.data) {
    const d = decodeDataUrl(ref.data);
    return d ? d.buffer : null;
  }
  return null;
}
