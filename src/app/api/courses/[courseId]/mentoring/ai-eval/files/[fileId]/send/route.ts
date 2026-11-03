import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { loadRoom } from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";

export const dynamic = "force-dynamic";

/**
 * 최종 평가 보고서 '보내기'(POST) / '회수'(DELETE) — 스태프 전용. ?studentId= 필수.
 * 보내면 학생·학부모가 멘토링 페이지 '최종 평가 보고서 내려받기'에서 열 수 있고(sentAt), 방 SSE 로 즉시 반영된다.
 */
async function loadFile(courseId: string, studentId: string, fileId: string) {
  const f = await prisma.mentoringGenFile.findUnique({ where: { id: fileId } });
  if (!f || f.courseId !== courseId || f.studentId !== studentId) return null;
  return f;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; fileId: string }> }) {
  const { courseId, fileId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const f = await loadFile(courseId, gate.studentId, fileId);
  if (!f) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  if (f.kind !== "report") return NextResponse.json({ error: "최종 평가 보고서만 보낼 수 있습니다." }, { status: 400 });
  const now = new Date();
  try {
    await prisma.mentoringGenFile.update({ where: { id: fileId }, data: { sentAt: now, sentBy: gate.userId } });
  } catch {
    return NextResponse.json({ error: "DB 스키마가 아직 적용되지 않았습니다(sentAt). 배포 후 다시 시도하세요." }, { status: 500 });
  }
  try { publishMentoring(courseId, gate.studentId, await loadRoom(courseId, gate.studentId)); } catch { /* 무시 */ }
  return NextResponse.json({ ok: true, sentAt: now.toISOString() });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; fileId: string }> }) {
  const { courseId, fileId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const f = await loadFile(courseId, gate.studentId, fileId);
  if (!f) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  try {
    await prisma.mentoringGenFile.update({ where: { id: fileId }, data: { sentAt: null, sentBy: null } });
  } catch {
    return NextResponse.json({ error: "DB 스키마가 아직 적용되지 않았습니다(sentAt). 배포 후 다시 시도하세요." }, { status: 500 });
  }
  try { publishMentoring(courseId, gate.studentId, await loadRoom(courseId, gate.studentId)); } catch { /* 무시 */ }
  return NextResponse.json({ ok: true });
}
