import { getCourse, findActivity } from "@/lib/course/content";
import { prisma } from "@/lib/prisma";
import { r2Enabled, decodeDataUrl, storeUploadDataUrl } from "@/lib/private-file";

/**
 * 레슨(강의)별 관리자 편집 콘텐츠 블록. 강좌마다 강의 화면을 노션처럼 직접 구성.
 * 블록: 제목 / 텍스트 / 파일(업로드) / 링크 / 구분선.
 * Neon DB(LessonContent, blocks=JSON)에 영구 저장 — 관리자가 편집·저장한 콘텐츠가
 * Render 배포에도 유지된다. (과거엔 /var/data 파일 저장 → 배포마다 초기화됐다.)
 */
export type Block =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "file"; name: string; size: number; dataUrl: string; fileKey?: string; fileMime?: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "link"; title: string; url: string; desc: string }
  | { id: string; type: "divider" };

/**
 * 저장된 편집 콘텐츠가 없을 때 보여줄 기본 블록을 시드(강의노트 본문·강의자료)에서 만든다.
 * 관리자가 편집기에서 이 내용을 그대로 보고 수정·저장하면 그 이후로는 저장본이 우선한다.
 */
function seedDefaultBlocks(courseId: string, activityId: string): Block[] {
  const course = getCourse(courseId);
  if (!course) return [];
  const found = findActivity(course, activityId);
  if (!found) return [];
  const a = found.activity;
  const out: Block[] = [];
  for (const [i, p] of (a.body ?? []).entries()) {
    if (p && p.trim()) out.push({ id: `seed-t-${i}`, type: "text", text: p });
  }
  const mats = a.materials ?? [];
  const online = a.onlineResources ?? [];
  if (mats.length > 0 || online.length > 0) {
    out.push({ id: "seed-h-mat", type: "heading", text: "강의자료" });
    for (const [i, m] of mats.entries()) {
      out.push({ id: `seed-m-${i}`, type: "link", title: m.name, url: m.href ?? "#", desc: m.sizeLabel ?? "" });
    }
    for (const [i, r] of online.entries()) {
      out.push({ id: `seed-o-${i}`, type: "link", title: r.label, url: r.href, desc: "" });
    }
  }
  return out;
}

export async function getBlocks(courseId: string, activityId: string): Promise<Block[]> {
  const row = await prisma.lessonContent.findUnique({ where: { courseId_activityId: { courseId, activityId } }, select: { blocks: true } });
  if (row && Array.isArray(row.blocks)) return row.blocks as unknown as Block[]; // 저장본(빈 배열 포함) 우선
  return seedDefaultBlocks(courseId, activityId); // 미저장 → 시드 기본 블록
}

export async function setBlocks(courseId: string, activityId: string, blocks: Block[]): Promise<Block[]> {
  // R2 사용 시: 새로 올라온 파일 블록(base64 dataUrl)을 R2 로 옮기고, dataUrl 은 서빙 URL 로 교체한다.
  // (이미 옮겨진 블록은 dataUrl 이 서빙 URL 이라 그대로 둔다. R2 미사용이면 base64 인라인 유지.)
  const processed: Block[] = [];
  for (const b of blocks) {
    if (b.type === "file" && r2Enabled() && !b.fileKey && b.dataUrl.startsWith("data:")) {
      const decoded = decodeDataUrl(b.dataUrl);
      if (decoded) {
        const ref = await storeUploadDataUrl(`lesson/${courseId}/${activityId}`, b.name, decoded.mime, b.dataUrl);
        if (ref.key) {
          processed.push({ ...b, fileKey: ref.key, fileMime: decoded.mime, dataUrl: `/api/courses/${courseId}/lessons/${activityId}/file?blockId=${encodeURIComponent(b.id)}` });
          continue;
        }
      }
    }
    processed.push(b);
  }

  const data = processed as unknown as import("@prisma/client").Prisma.InputJsonValue;
  await prisma.lessonContent.upsert({
    where: { courseId_activityId: { courseId, activityId } },
    create: { courseId, activityId, blocks: data },
    update: { blocks: data },
  });
  return processed;
}

/** 강의 콘텐츠 파일 블록의 R2 참조(키·mime) 조회 — 서빙 라우트용. */
export async function getLessonFileRef(courseId: string, activityId: string, blockId: string): Promise<{ name: string; mime: string; key: string } | null> {
  const blocks = await getBlocks(courseId, activityId);
  const b = blocks.find((x) => x.id === blockId && x.type === "file") as Extract<Block, { type: "file" }> | undefined;
  if (!b || !b.fileKey) return null;
  return { name: b.name || "file", mime: b.fileMime || "application/octet-stream", key: b.fileKey };
}
