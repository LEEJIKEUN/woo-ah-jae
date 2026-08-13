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

/**
 * 멘토링 더보기(그리드) — 스태프가 담당 강좌의 '모든 수강생' 방을 본다(메시지 없어도 포함).
 * 한 번의 메시지 조회로 방별 최근 메시지·안읽음을 계산.
 */
export async function getMentoringRooms(user: { userId: string; role: string }): Promise<{ courses: { id: string; title: string }[]; rooms: Conversation[] }> {
  if (user.role !== "ADMIN" && user.role !== "FACILITATOR") return { courses: [], rooms: [] };
  const courseIds =
    user.role === "ADMIN"
      ? COURSES.map((c) => c.id)
      : (await prisma.facilitatorCourse.findMany({ where: { facilitatorUserId: user.userId }, select: { courseId: true } })).map((f) => f.courseId);
  const courses = courseIds.map((id) => ({ id, title: getCourse(id)?.title ?? id }));
  if (!courseIds.length) return { courses, rooms: [] };

  const enrs = await prisma.enrollment.findMany({ where: { courseId: { in: courseIds } }, select: { courseId: true, userId: true } });
  if (!enrs.length) return { courses, rooms: [] };

  const studentIds = [...new Set(enrs.map((e) => e.userId))];
  const [users, allMsgs, reads] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: studentIds }, lifecycleStatus: "ACTIVE" }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } }),
    prisma.mentoringMessage.findMany({ where: { courseId: { in: courseIds } }, orderBy: { createdAt: "asc" }, select: { courseId: true, studentId: true, text: true, kind: true, senderRole: true, deletedAt: true, createdAt: true } }),
    prisma.mentoringRead.findMany({ where: { userId: user.userId } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.studentProfile?.realName || u.email]));
  const active = new Set(users.map((u) => u.id));
  const readAt = new Map(reads.map((r) => [`${r.courseId}::${r.roomStudentId}`, r.lastReadAt.getTime()]));

  type M = { text: string; kind: string; senderRole: string; deletedAt: Date | null; createdAt: Date };
  const byRoom = new Map<string, M[]>();
  for (const m of allMsgs) {
    const k = `${m.courseId}::${m.studentId}`;
    const arr = byRoom.get(k);
    if (arr) arr.push(m);
    else byRoom.set(k, [m]);
  }

  const rooms: Conversation[] = [];
  for (const e of enrs) {
    if (!active.has(e.userId)) continue;
    const k = `${e.courseId}::${e.userId}`;
    const list = byRoom.get(k) ?? [];
    const last = list[list.length - 1];
    const lastRead = readAt.get(k) ?? 0;
    let unread = 0;
    for (const m of list) if (m.createdAt.getTime() > lastRead && m.senderRole === "student") unread++;
    rooms.push({
      courseId: e.courseId,
      roomStudentId: e.userId,
      title: nameOf.get(e.userId) ?? "학생",
      unread,
      lastText: last ? (last.deletedAt ? "삭제된 메시지" : last.kind === "file" ? "📎 파일" : last.text) : "",
      lastAt: last ? last.createdAt.toISOString() : "",
      canSend: true,
    });
  }
  rooms.sort((a, b) => b.unread - a.unread || a.title.localeCompare(b.title, "ko"));
  return { courses, rooms };
}

/** 멘토링 방 읽음 처리 — 안읽음 배지 해제 기준 갱신. */
export async function markMentoringRead(userId: string, courseId: string, roomStudentId: string): Promise<void> {
  await prisma.mentoringRead.upsert({
    where: { userId_courseId_roomStudentId: { userId, courseId, roomStudentId } },
    create: { userId, courseId, roomStudentId },
    update: { lastReadAt: new Date() },
  });
}
