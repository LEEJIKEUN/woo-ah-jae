import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { listNotifications, unreadNotificationCount, markAllNotificationsRead } from "@/lib/notification-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? "30") || 30;
    const [items, unread] = await Promise.all([listNotifications(auth.userId, limit), unreadNotificationCount(auth.userId)]);
    return NextResponse.json({ items, unread });
  } catch (error) {
    return jsonError(error);
  }
}

// 알림 모두 읽음 처리(벨을 열 때)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    await markAllNotificationsRead(auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
