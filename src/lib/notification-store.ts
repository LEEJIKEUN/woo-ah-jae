import { prisma } from "@/lib/prisma";
import { pingUser } from "@/lib/inbox-bus";

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
  const items = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  return items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, read: !!n.readAt, at: n.createdAt.toISOString() }));
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
