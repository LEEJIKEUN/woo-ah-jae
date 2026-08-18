import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 강좌별 수강신청 기록 — Neon DB(Enrollment 테이블)에 보존한다.
 * (이전에는 서버 디스크 파일에 저장했으나, 배포/재시작 시 유실 위험이 있어 DB로 이관.)
 * 함수 시그니처는 파일 버전과 동일하게 유지하여 사용처 변경이 없다.
 */

/** 신청 인원 (활성 계정만 집계 — 탈퇴/삭제된 유령 카운트 방지) */
export async function getApplied(courseId: string): Promise<number> {
  return prisma.enrollment.count({ where: { courseId, user: { lifecycleStatus: "ACTIVE" } } });
}

/** 수강생 userId 목록(출석·이수 관리용, 활성 계정만) */
export async function getEnrolledUserIds(courseId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({
    where: { courseId, user: { lifecycleStatus: "ACTIVE" } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** 특정 사용자의 수강신청 여부 */
export async function isUserEnrolled(courseId: string, userId: string): Promise<boolean> {
  const row = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { userId: true },
  });
  return !!row;
}

/** 수강신청(사용자ID 기록). 이미 신청했으면 그대로 성공(already), 정원 초과면 실패(full). */
export async function enrollUser(
  courseId: string,
  userId: string,
  capacity: number
): Promise<{ ok: boolean; applied: number; full: boolean; already: boolean }> {
  if (await isUserEnrolled(courseId, userId)) {
    const applied = await getApplied(courseId);
    return { ok: true, applied, full: applied >= capacity, already: true };
  }
  const applied = await getApplied(courseId);
  if (applied >= capacity) {
    return { ok: false, applied, full: true, already: false };
  }
  try {
    await prisma.enrollment.create({ data: { courseId, userId } });
  } catch (e) {
    // 동시 신청 등으로 이미 존재하면 성공(already)로 처리
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const now = await getApplied(courseId);
      return { ok: true, applied: now, full: now >= capacity, already: true };
    }
    throw e;
  }
  const next = applied + 1;
  return { ok: true, applied: next, full: next >= capacity, already: false };
}

/** 특정 학생의 수강신청만 취소(로스터에서 제외). 기존 기록(이수·글·시험 등)은 건드리지 않는다. */
export async function unenrollUser(courseId: string, userId: string): Promise<{ applied: number }> {
  await prisma.enrollment.deleteMany({ where: { courseId, userId } });
  const applied = await getApplied(courseId);
  return { applied };
}

/** 테스트/관리자용 리셋 */
export async function resetEnrollment(courseId: string): Promise<void> {
  await prisma.enrollment.deleteMany({ where: { courseId } });
}
