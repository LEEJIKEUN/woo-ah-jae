import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deletePrivateKey } from "@/lib/private-file";

/**
 * 사용자 완전 삭제(탈퇴·관리자 하드삭제) 시, FK 없이 String userId 로만 연결된 흔적을
 * 남기지 않도록 정리하는 공용 유틸.
 * (예: 탈퇴 학생이 올린 과제/피어리뷰가 상대 학생 화면에 계속 남던 문제 방지)
 */

/** DB 삭제 전에 지워야 할 R2 파일 키 + 시험 attempt id 수집. */
export async function collectUserCleanup(id: string): Promise<{ r2Keys: string[]; attemptIds: string[] }> {
  const [assigns, reports, messages, attempts] = await Promise.all([
    prisma.mentoringAssignment.findMany({ where: { OR: [{ studentId: id }, { uploaderId: id }] }, select: { fileKey: true } }),
    prisma.mentoringReport.findMany({ where: { studentId: id }, select: { fileKey: true } }),
    prisma.mentoringMessage.findMany({ where: { OR: [{ studentId: id }, { senderId: id }] }, select: { fileKey: true } }),
    prisma.examAttempt.findMany({ where: { studentId: id }, select: { id: true } }),
  ]);
  const r2Keys = [...assigns, ...reports, ...messages].map((x) => x.fileKey).filter((k): k is string => !!k);
  return { r2Keys, attemptIds: attempts.map((a) => a.id) };
}

/** 트랜잭션 내부에서 호출 — 멘토링·피어리뷰·시험·알림·좋아요·부모연결 등 정리. */
export async function purgeUserRelations(tx: Prisma.TransactionClient, id: string, attemptIds: string[]): Promise<void> {
  // 멘토링·피어리뷰(FK 없음)
  await tx.mentoringPeerReview.deleteMany({ where: { OR: [{ recipientStudentId: id }, { authorStudentId: id }] } });
  await tx.mentoringAssignment.deleteMany({ where: { OR: [{ studentId: id }, { uploaderId: id }] } });
  await tx.mentoringReport.deleteMany({ where: { studentId: id } });
  await tx.mentoringMessage.deleteMany({ where: { OR: [{ studentId: id }, { senderId: id }] } });
  await tx.mentoringBook.deleteMany({ where: { studentId: id } });
  await tx.mentoringNotice.deleteMany({ where: { OR: [{ studentId: id }, { authorId: id }] } });
  await tx.mentoringSete.deleteMany({ where: { studentId: id } });
  await tx.mentoringRead.deleteMany({ where: { OR: [{ userId: id }, { roomStudentId: id }] } });

  // 시험(FK 없음)
  if (attemptIds.length) await tx.examAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } });
  await tx.examAttempt.deleteMany({ where: { studentId: id } });
  await tx.examAssignment.deleteMany({ where: { studentId: id } });

  // 기타 흔적
  await tx.facilitatorCourse.deleteMany({ where: { facilitatorUserId: id } });
  await tx.notification.deleteMany({ where: { userId: id } });
  await tx.parentChildLink.deleteMany({ where: { OR: [{ parentUserId: id }, { childUserId: id }] } });
  await tx.coursePostLike.deleteMany({ where: { userId: id } });
  await tx.coursePostCommentLike.deleteMany({ where: { userId: id } });
}

/** R2 파일 실삭제(best-effort — 실패해도 삭제는 완료). */
export async function deleteUserFiles(r2Keys: string[]): Promise<void> {
  for (const k of r2Keys) await deletePrivateKey(k);
}
