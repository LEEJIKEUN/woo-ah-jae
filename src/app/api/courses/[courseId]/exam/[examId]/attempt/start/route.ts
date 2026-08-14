import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { startAttempt } from "@/lib/exam/store";

export const dynamic = "force-dynamic";

/** 응시 시작(또는 기존 세션 반환) — 학생 전용. 타이머는 이 시점의 deadlineAt(서버 고정) 기준. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; examId: string }> }) {
  try {
    const { courseId, examId } = await params;
    const auth = await getAuthFromRequest(request);
    if (auth.role !== "STUDENT") return NextResponse.json({ error: "학생 계정만 응시할 수 있습니다." }, { status: 403 });

    const res = await startAttempt(courseId, examId, auth.userId);
    switch (res.code) {
      case "NOT_FOUND":
        return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });
      case "NOT_ASSIGNED":
        return NextResponse.json({ error: "배정된 시험이 아닙니다." }, { status: 403 });
      case "NOT_OPEN":
        return NextResponse.json({ code: "NOT_OPEN", opensAt: res.opensAt, error: "아직 응시할 수 없습니다." }, { status: 403 });
      case "CLOSED":
        return NextResponse.json({ code: "CLOSED", error: "응시할 수 없는 시험입니다." }, { status: 403 });
      case "OK":
        return NextResponse.json(res.data);
    }
  } catch (error) {
    return jsonError(error);
  }
}
