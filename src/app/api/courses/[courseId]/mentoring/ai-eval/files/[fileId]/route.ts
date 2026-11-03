import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { isApprovedChild } from "@/lib/course/parent-child";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { presignGetUrl, deletePrivateObject } from "@/lib/r2";
import { loadRoom } from "@/lib/mentoring-store";
import { publishMentoring } from "@/lib/mentoring-bus";

export const dynamic = "force-dynamic";

function rawKey(k: string) {
  return k.startsWith("r2://") ? k.slice("r2://".length) : k;
}

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * 저장된 생성 PDF 열기/다운로드 — 재생성 없이 R2 서명 URL 로 302. 추가 비용 없음.
 * - 스태프: 모든 생성 파일(정리·보고서)
 * - 학생 본인 / 학부모(승인된 자녀): 교사가 '보내기' 한 최종 평가 보고서만(sentAt 있음)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; fileId: string }> }) {
  const { courseId, fileId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId") ?? "";

  const session = await sessionFromReq(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let sid = "";
  let studentSide = false;
  if (isStaffRole(session.role)) {
    const gate = await gateAiEval(request, courseId, studentId);
    if ("error" in gate) return gate.error;
    sid = gate.studentId;
  } else {
    studentSide = true;
    if (session.role === "STUDENT") {
      if (studentId && studentId !== session.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      sid = session.userId;
    } else if (session.role === "PARENT") {
      if (!studentId || !(await isApprovedChild(session.userId, studentId))) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      sid = studentId;
    } else {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    if (!(await isUserEnrolled(courseId, sid))) return NextResponse.json({ error: "수강생이 아닙니다." }, { status: 403 });
  }

  const f = await prisma.mentoringGenFile.findUnique({ where: { id: fileId } });
  if (!f || f.courseId !== courseId || f.studentId !== sid) return new NextResponse("Not found", { status: 404 });
  if (studentSide && (f.kind !== "report" || !f.sentAt)) return new NextResponse("Not found", { status: 404 }); // 보내지 않은 파일은 학생에게 없는 것과 같다
  const name = `${f.kind === "report" ? "평가보고서" : "활동정리"}_${f.label}.pdf`;
  const signed = await presignGetUrl(rawKey(f.fileKey), 2 * 3600, { fileName: name, mime: "application/pdf", disposition: "inline" });
  return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}

/** 저장된 생성 PDF 삭제(스태프 전용) — DB 행 + R2 오브젝트 제거. 보낸 보고서였다면 학생 화면도 즉시 갱신. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; fileId: string }> }) {
  const { courseId, fileId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const f = await prisma.mentoringGenFile.findUnique({ where: { id: fileId } });
  if (!f || f.courseId !== courseId || f.studentId !== gate.studentId) return new NextResponse("Not found", { status: 404 });
  try { await deletePrivateObject(rawKey(f.fileKey)); } catch { /* best-effort */ }
  await prisma.mentoringGenFile.delete({ where: { id: fileId } });
  if (f.kind === "report" && f.sentAt) {
    try { publishMentoring(courseId, gate.studentId, await loadRoom(courseId, gate.studentId)); } catch { /* 무시 */ }
  }
  return NextResponse.json({ ok: true });
}
