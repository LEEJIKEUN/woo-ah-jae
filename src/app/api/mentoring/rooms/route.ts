import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { getMentoringRooms } from "@/lib/mentoring-inbox";

export const dynamic = "force-dynamic";

/** 멘토링 더보기용 — 스태프의 담당 강좌 전체 수강생 방 목록. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (auth.role !== "ADMIN" && auth.role !== "FACILITATOR") {
      return NextResponse.json({ error: "관리자·퍼실리테이터만 이용할 수 있습니다." }, { status: 403 });
    }
    const data = await getMentoringRooms({ userId: auth.userId, role: auth.role });
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
