import { getCourse, findActivity } from "@/lib/course/content";
import { prisma } from "@/lib/prisma";

/**
 * 레슨(강의)별 관리자 편집 콘텐츠 블록. 강좌마다 강의 화면을 노션처럼 직접 구성.
 * 블록: 제목 / 텍스트 / 파일(업로드) / 링크 / 구분선.
 * Neon DB(LessonContent, blocks=JSON)에 영구 저장 — 관리자가 편집·저장한 콘텐츠가
 * Render 배포에도 유지된다. (과거엔 /var/data 파일 저장 → 배포마다 초기화됐다.)
 */
export type Block =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "file"; name: string; size: number; dataUrl: string }
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
  const data = blocks as unknown as import("@prisma/client").Prisma.InputJsonValue;
  await prisma.lessonContent.upsert({
    where: { courseId_activityId: { courseId, activityId } },
    create: { courseId, activityId, blocks: data },
    update: { blocks: data },
  });
  return blocks;
}
