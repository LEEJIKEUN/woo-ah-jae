import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { collectStudentDossier } from "@/lib/mentoring/dossier";
import { buildDossierPdf } from "@/lib/mentoring/dossier-pdf";

export const dynamic = "force-dynamic";

/** 학생 활동 취합 dossier 를 한글 PDF 로 다운로드(스태프 전용). 저장 스냅샷 우선, 없으면 즉석 취합. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;

  const row = await prisma.mentoringAiEval.findUnique({ where: { courseId_studentId: { courseId, studentId: gate.studentId } }, select: { dossier: true } });
  let dossierText = row?.dossier ?? "";
  if (!dossierText) dossierText = (await collectStudentDossier(courseId, gate.studentId)).text;
  if (!dossierText.trim()) return new NextResponse("자료가 없습니다.", { status: 404 });

  const pdf = await buildDossierPdf({ title: "학생 활동 종합 자료 (관리자용)", dossierText });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`student_dossier_${gate.studentId}.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
