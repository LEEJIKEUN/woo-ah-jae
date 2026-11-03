import { NextRequest, NextResponse } from "next/server";
import { gateAiEvalCourse } from "@/lib/mentoring/ai-eval-gate";
import { loadAiEvalOverview } from "@/lib/mentoring/overview";

export const dynamic = "force-dynamic";

/** 수강생 전체의 정리 PDF·AI 세특·평가 보고서(보냄) 현황 — 세특·과제 현황 일괄 처리 패널용(스태프 전용). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const gate = await gateAiEvalCourse(request, courseId);
  if ("error" in gate) return gate.error;
  const rows = await loadAiEvalOverview(courseId);
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "private, no-store" } });
}
