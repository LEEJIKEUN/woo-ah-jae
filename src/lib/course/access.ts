import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isUserEnrolled } from "@/lib/enrollment-store";

export type CourseSession = { userId: string; role: "ADMIN" | "STUDENT"; email: string };

/** 쿠키에서 세션 해석(없거나 무효면 null) */
export async function getSession(): Promise<CourseSession | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return (await verifySessionToken(token)) as CourseSession;
  } catch {
    return null;
  }
}

/** 관리자 or 수강신청 완료 여부 (강의실 입장 가능한지) */
export async function canEnterClassroom(courseId: string, session: CourseSession | null): Promise<boolean> {
  if (!session) return false;
  if (session.role === "ADMIN") return true; // 관리자는 모든 강의실 입장 가능
  return isUserEnrolled(courseId, session.userId);
}

/**
 * 강의실/강의/멘토링 접근 게이트.
 * - 비로그인 → 로그인 페이지로
 * - 로그인했지만 미수강(학생) → 강좌 소개로(수강신청 유도)
 * - 관리자 또는 수강신청 완료 학생 → 통과
 */
export async function requireClassroomAccess(courseId: string, nextPath: string): Promise<CourseSession> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (session.role === "ADMIN") return session;
  if (await isUserEnrolled(courseId, session.userId)) return session;
  redirect(`/course/${courseId}`);
}
