import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { isUserEnrolled } from "@/lib/enrollment-store";

/**
 * AI 세특 엔드포인트 공통 게이트 — 관리자·퍼실 전용(학생·학부모 403).
 * 퍼실은 담당 강좌만. 대상 학생은 해당 강좌 수강생이어야 한다.
 */
export type AiEvalGate = { userId: string; role: string; studentId: string };

export async function gateAiEval(request: NextRequest, courseId: string, studentId: unknown): Promise<AiEvalGate | { error: NextResponse }> {
  if (!getCourse(courseId)) return { error: NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 }) };

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let session: Awaited<ReturnType<typeof verifySessionToken>> | null = null;
  try { session = token ? await verifySessionToken(token) : null; } catch { session = null; }
  if (!session) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (!isStaffRole(session.role)) return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  if (session.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, session.userId))) {
    return { error: NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 }) };
  }

  const sid = typeof studentId === "string" ? studentId : "";
  if (!sid) return { error: NextResponse.json({ error: "학생을 선택해 주세요." }, { status: 400 }) };
  if (!(await isUserEnrolled(courseId, sid))) return { error: NextResponse.json({ error: "수강생이 아닙니다." }, { status: 400 }) };

  return { userId: session.userId, role: session.role, studentId: sid };
}
