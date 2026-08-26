import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { collectStudentDossier } from "@/lib/mentoring/dossier";
import { generateEvalFeedback } from "@/lib/mentoring/eval-report";
import { buildEvalReportPdf } from "@/lib/mentoring/eval-report-pdf";

export const dynamic = "force-dynamic";

/**
 * ③ 최종 평가 보고서 PDF(스태프 전용) — 요소별 원문 + AI 평가/피드백 + (있으면)세특을 담아 반환.
 * 저장하지 않고 매 요청 시 생성(브라우저가 blob 으로 새 탭에 연다).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const body = (await request.json().catch(() => null)) as { studentId?: unknown; includeCommunity?: unknown } | null;
  const gate = await gateAiEval(request, courseId, body?.studentId);
  if ("error" in gate) return gate.error;
  const includeCommunity = body?.includeCommunity !== false;

  const d = await collectStudentDossier(courseId, gate.studentId, { includeCommunity });
  if (!d.text.trim()) return NextResponse.json({ error: "자료가 없습니다." }, { status: 404 });

  const titles = d.sections.filter((s) => s.body.trim() !== "(없음)").map((s) => s.title);
  const gen = await generateEvalFeedback(d.text, titles);
  if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: 502 });

  const row = await prisma.mentoringAiEval.findUnique({ where: { courseId_studentId: { courseId, studentId: gate.studentId } }, select: { evalText: true } });

  const pdf = await buildEvalReportPdf({ studentName: d.studentName, courseId, sections: d.sections, report: gen.report, sete: row?.evalText ?? "" });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`평가보고서_${d.studentName}.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
