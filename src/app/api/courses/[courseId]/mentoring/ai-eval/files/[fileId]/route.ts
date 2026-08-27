import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { presignGetUrl, deletePrivateObject } from "@/lib/r2";

export const dynamic = "force-dynamic";

function rawKey(k: string) {
  return k.startsWith("r2://") ? k.slice("r2://".length) : k;
}

/** 저장된 생성 PDF 열기/다운로드(스태프 전용) — 재생성 없이 R2 서명 URL 로 302. 추가 비용 없음. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; fileId: string }> }) {
  const { courseId, fileId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const f = await prisma.mentoringGenFile.findUnique({ where: { id: fileId } });
  if (!f || f.courseId !== courseId || f.studentId !== gate.studentId) return new NextResponse("Not found", { status: 404 });
  const name = `${f.kind === "report" ? "평가보고서" : "활동정리"}_${f.label}.pdf`;
  const signed = await presignGetUrl(rawKey(f.fileKey), 2 * 3600, { fileName: name, mime: "application/pdf", disposition: "inline" });
  return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}

/** 저장된 생성 PDF 삭제(스태프 전용) — DB 행 + R2 오브젝트 제거. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; fileId: string }> }) {
  const { courseId, fileId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const f = await prisma.mentoringGenFile.findUnique({ where: { id: fileId } });
  if (!f || f.courseId !== courseId || f.studentId !== gate.studentId) return new NextResponse("Not found", { status: 404 });
  try { await deletePrivateObject(rawKey(f.fileKey)); } catch { /* best-effort */ }
  await prisma.mentoringGenFile.delete({ where: { id: fileId } });
  return NextResponse.json({ ok: true });
}
