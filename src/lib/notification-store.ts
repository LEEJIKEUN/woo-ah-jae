import { prisma } from "@/lib/prisma";
import { pingUser } from "@/lib/inbox-bus";
import { getEnrolledUserIds } from "@/lib/enrollment-store";

export type NotificationInput = { userId: string; kind: string; title: string; body?: string; href: string };

/** 여러 사용자에게 알림 생성(이벤트 발생 시). best-effort — 실패해도 원 동작을 막지 않는다. */
export async function createNotifications(rows: NotificationInput[]): Promise<void> {
  const data = rows.filter((r) => r.userId && r.title).map((r) => ({ userId: r.userId, kind: r.kind, title: r.title.slice(0, 200), body: (r.body ?? "").slice(0, 500), href: r.href }));
  if (!data.length) return;
  try {
    await prisma.notification.createMany({ data });
    for (const uid of new Set(data.map((d) => d.userId))) pingUser(uid); // 실시간 배지
  } catch {
    /* 알림 실패는 무시 */
  }
}

export async function listNotifications(userId: string, limit = 30) {
  const items = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(1, limit), 300) });
  return items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, read: !!n.readAt, at: n.createdAt.toISOString() }));
}

/** 강좌 스태프(관리자 전원 + 해당 강좌 담당 퍼실) userId 목록. */
export async function courseStaffIds(courseId: string): Promise<string[]> {
  const [admins, facs] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN", lifecycleStatus: "ACTIVE" }, select: { id: true } }),
    prisma.facilitatorCourse.findMany({ where: { courseId }, select: { facilitatorUserId: true } }),
  ]);
  return [...new Set([...admins.map((a) => a.id), ...facs.map((f) => f.facilitatorUserId)])];
}

/** 강좌 스태프에게 알림(구성원 변동 감지용). 행위자는 제외. */
export async function notifyCourseStaff(courseId: string, actorUserId: string, n: { kind: string; title: string; body?: string; href: string }): Promise<void> {
  const ids = (await courseStaffIds(courseId)).filter((id) => id !== actorUserId);
  await createNotifications(ids.map((uid) => ({ userId: uid, ...n })));
}

/**
 * 본문에서 @이름 멘션을 찾아 해당 수강생과 승인된 학부모에게 알림.
 * 이름은 강좌 수강생 실명과 정확히 일치(@ 접두)해야 매칭. 행위자 본인은 제외.
 */
export async function notifyMentions(
  courseId: string,
  text: string,
  opts: { actorUserId: string; href: string; context: string }
): Promise<void> {
  if (!text || !text.includes("@")) return;
  const ids = await getEnrolledUserIds(courseId);
  if (!ids.length) return;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, studentProfile: { select: { realName: true } } },
  });
  // @이름 뒤에 다른 글자가 붙지 않는 경계 매칭 → "홍길"이 "@홍길동"에 오탐되지 않게
  const mentionedByName = (name: string) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return new RegExp(`(?:^|[^\\p{L}\\p{N}_])@${esc}(?![\\p{L}\\p{N}_])`, "u").test(text);
    } catch {
      return text.includes(`@${name}`);
    }
  };
  const mentioned = users.filter((u) => {
    const nm = u.studentProfile?.realName?.trim();
    return nm && u.id !== opts.actorUserId && mentionedByName(nm);
  });
  if (!mentioned.length) return;

  const actor = await prisma.user.findUnique({ where: { id: opts.actorUserId }, select: { studentProfile: { select: { realName: true } } } });
  const actorName = actor?.studentProfile?.realName ?? "누군가";

  const links = await prisma.parentChildLink.findMany({
    where: { childUserId: { in: mentioned.map((u) => u.id) }, status: "APPROVED" },
    select: { parentUserId: true, child: { select: { studentProfile: { select: { realName: true } } } } },
  });

  const body = text.slice(0, 300);
  const rows: NotificationInput[] = [];
  for (const u of mentioned) {
    rows.push({ userId: u.id, kind: "mention", title: `${actorName}님이 ${opts.context}에서 회원님을 언급했어요`, body, href: opts.href });
  }
  for (const l of links) {
    if (l.parentUserId === opts.actorUserId) continue;
    const childName = l.child.studentProfile?.realName ?? "자녀";
    rows.push({ userId: l.parentUserId, kind: "mention", title: `${actorName}님이 ${opts.context}에서 ${childName}님을 언급했어요`, body, href: opts.href });
  }
  await createNotifications(rows);
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
