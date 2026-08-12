import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { prisma } from "@/lib/prisma";

export type Role = "STUDENT" | "FACILITATOR" | "PARENT" | "ADMIN";
export type CourseSession = { userId: string; role: Role; email: string };

/** 관리자·퍼실리테이터(강의 담당자) = 강의 운영 권한(잠금 무시·전체 접근·콘텐츠 편집) */
export function isStaffRole(role: string): boolean {
  return role === "ADMIN" || role === "FACILITATOR";
}

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

/** 학부모가 이 강좌에 (승인된) 자녀가 수강 중인지 — 학부모의 열람 접근 근거 */
export async function isParentOfEnrolledChild(courseId: string, parentUserId: string): Promise<boolean> {
  const links = await prisma.parentChildLink.findMany({
    where: { parentUserId, status: "APPROVED" },
    select: { childUserId: true },
  });
  for (const l of links) {
    if (await isUserEnrolled(courseId, l.childUserId)) return true;
  }
  return false;
}

/** 강의실 입장 가능 여부 (관리자·퍼실리테이터 or 수강신청 완료 or 자녀 수강중인 학부모) */
export async function canEnterClassroom(courseId: string, session: CourseSession | null): Promise<boolean> {
  if (!session) return false;
  if (isStaffRole(session.role)) return true;
  if (await isUserEnrolled(courseId, session.userId)) return true;
  if (session.role === "PARENT") return isParentOfEnrolledChild(courseId, session.userId);
  return false;
}

/**
 * 강의실/강의/멘토링 접근 게이트.
 * - 비로그인 → 로그인
 * - 관리자·퍼실리테이터 → 통과(전체 접근)
 * - 수강신청 완료 학생 → 통과
 * - 그 외 로그인 학생 → 강좌 소개로(수강신청 유도)
 */
export async function requireClassroomAccess(courseId: string, nextPath: string): Promise<CourseSession> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (isStaffRole(session.role)) return session;
  if (await isUserEnrolled(courseId, session.userId)) return session;
  if (session.role === "PARENT" && (await isParentOfEnrolledChild(courseId, session.userId))) return session;
  redirect(`/course/${courseId}`);
}
