import { prisma } from "@/lib/prisma";
import { getCourse, COURSES } from "@/lib/course/content";

export type Conversation = {
  courseId: string;
  roomStudentId: string;
  title: string;
  unread: number;
  lastText: string;
  lastAt: string;
  canSend: boolean;
};

/** 사용자의 1:1 멘토링 대화함(안읽음 포함). 학생=자기 방(교사 메시지), 스태프=담당 학생 방(학생 메시지), 학부모=자녀 방(전체). */
export async function getInbox(user: { userId: string; role: string }): Promise<{ conversations: Conversation[]; unread: number }> {
  const rooms: { courseId: string; roomStudentId: string; other: "teacher" | "student" | "all" }[] = [];

  if (user.role === "STUDENT") {
    const enr = await prisma.enrollment.findMany({ where: { userId: user.userId }, select: { courseId: true } });
    for (const e of enr) rooms.push({ courseId: e.courseId, roomStudentId: user.userId, other: "teacher" });
  } else if (user.role === "ADMIN" || user.role === "FACILITATOR") {
    const courseIds =
      user.role === "ADMIN"
        ? COURSES.map((c) => c.id)
        : (await prisma.facilitatorCourse.findMany({ where: { facilitatorUserId: user.userId }, select: { courseId: true } })).map((f) => f.courseId);
    if (courseIds.length) {
      const distinctRooms = await prisma.mentoringMessage.findMany({ where: { courseId: { in: courseIds } }, select: { courseId: true, studentId: true }, distinct: ["courseId", "studentId"] });
      for (const r of distinctRooms) rooms.push({ courseId: r.courseId, roomStudentId: r.studentId, other: "student" });
    }
  } else if (user.role === "PARENT") {
    const links = await prisma.parentChildLink.findMany({ where: { parentUserId: user.userId, status: "APPROVED" }, select: { childUserId: true } });
    for (const l of links) {
      const enr = await prisma.enrollment.findMany({ where: { userId: l.childUserId }, select: { courseId: true } });
      for (const e of enr) rooms.push({ courseId: e.courseId, roomStudentId: l.childUserId, other: "all" });
    }
  }
  if (!rooms.length) return { conversations: [], unread: 0 };

  const studentIds = [...new Set(rooms.map((r) => r.roomStudentId))];
  const users = await prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } });
  const nameOf = new Map(users.map((u) => [u.id, u.studentProfile?.realName || u.email]));
  const reads = await prisma.mentoringRead.findMany({ where: { userId: user.userId, OR: rooms.map((r) => ({ courseId: r.courseId, roomStudentId: r.roomStudentId })) } });
  const readAt = new Map(reads.map((r) => [`${r.courseId}::${r.roomStudentId}`, r.lastReadAt.getTime()]));

  const conversations: Conversation[] = [];
  let unreadTotal = 0;
  for (const room of rooms) {
    const msgs = await prisma.mentoringMessage.findMany({
      where: { courseId: room.courseId, studentId: room.roomStudentId },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { text: true, kind: true, senderRole: true, deletedAt: true, createdAt: true },
    });
    if (!msgs.length) continue;
    const last = msgs[0];
    const lastReadTime = readAt.get(`${room.courseId}::${room.roomStudentId}`) ?? 0;
    let unread = 0;
    for (const m of msgs) {
      if (m.createdAt.getTime() <= lastReadTime) continue;
      const fromOther = room.other === "all" ? true : m.senderRole === room.other;
      if (fromOther) unread++;
    }
    unreadTotal += unread;
    const course = getCourse(room.courseId);
    const studentName = nameOf.get(room.roomStudentId) ?? "학생";
    const title = user.role === "STUDENT" ? course?.title ?? room.courseId : `${studentName} · ${course?.title ?? room.courseId}`;
    conversations.push({
      courseId: room.courseId,
      roomStudentId: room.roomStudentId,
      title,
      unread,
      lastText: last.deletedAt ? "삭제된 메시지" : last.kind === "file" ? "📎 파일" : last.text,
      lastAt: last.createdAt.toISOString(),
      canSend: user.role !== "PARENT",
    });
  }
  conversations.sort((a, b) => b.unread - a.unread || new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return { conversations, unread: unreadTotal };
}

/** 멘토링 방 읽음 처리 — 안읽음 배지 해제 기준 갱신. */
export async function markMentoringRead(userId: string, courseId: string, roomStudentId: string): Promise<void> {
  await prisma.mentoringRead.upsert({
    where: { userId_courseId_roomStudentId: { userId, courseId, roomStudentId } },
    create: { userId, courseId, roomStudentId },
    update: { lastReadAt: new Date() },
  });
}
