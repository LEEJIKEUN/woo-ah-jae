import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { markMentoringRead } from "@/lib/mentoring-inbox";

export const dynamic = "force-dynamic";

// 멘토링 방 읽음 처리(채팅 팝업/페이지를 열 때). 본인 배지 기준만 갱신하므로 저위험.
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const body = (await request.json().catch(() => null)) as { courseId?: unknown; roomStudentId?: unknown } | null;
    const courseId = typeof body?.courseId === "string" ? body.courseId : "";
    const roomStudentId = typeof body?.roomStudentId === "string" ? body.roomStudentId : "";
    if (!courseId || !roomStudentId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    await markMentoringRead(auth.userId, courseId, roomStudentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
