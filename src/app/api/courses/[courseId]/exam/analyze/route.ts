import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { isStaffRole, isFacilitatorOfCourse } from "@/lib/course/access";
import { validateUpload } from "@/lib/upload";
import { analyzeExamPdf } from "@/lib/exam/analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // AI 분석에 시간이 걸릴 수 있음

/** 시험지 PDF → 문항 구성·정답 자동 추출(스태프 전용). DB 저장 없이 분석 결과만 반환. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const auth = await getAuthFromRequest(request);
    if (!isStaffRole(auth.role)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    if (auth.role === "FACILITATOR" && !(await isFacilitatorOfCourse(courseId, auth.userId))) {
      return NextResponse.json({ error: "담당 강좌가 아닙니다." }, { status: 403 });
    }

    const form = await request.formData();
    const paper = form.get("paper");
    if (!(paper instanceof File) || paper.size === 0) return NextResponse.json({ error: "시험지 PDF를 첨부해 주세요." }, { status: 400 });
    if (paper.type !== "application/pdf") return NextResponse.json({ error: "PDF 파일만 분석할 수 있습니다." }, { status: 400 });
    try { validateUpload(paper); } catch { return NextResponse.json({ error: "PDF는 10MB 이하만 업로드할 수 있습니다." }, { status: 400 }); }

    const b64 = Buffer.from(await paper.arrayBuffer()).toString("base64");
    const result = await analyzeExamPdf(b64);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ questions: result.questions, answerStartPage: result.answerStartPage });
  } catch (error) {
    return jsonError(error);
  }
}
