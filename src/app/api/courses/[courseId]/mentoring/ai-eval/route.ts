import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { collectStudentDossier } from "@/lib/mentoring/dossier";
import { generateSete } from "@/lib/mentoring/generate-sete";
import { getReportFileData } from "@/lib/mentoring-store";
import { readUpload } from "@/lib/private-file";

export const dynamic = "force-dynamic";

// 저장 스냅샷 상한(재생성·PDF 근거용). dossier 자체는 40KB 상한이라 여유.
const DOSSIER_STORE_CAP = 60 * 1024;
const MAX_REPORT_PDF_BYTES = 25 * 1024 * 1024;

type Row = { evalText: string; aiText: string; byteCount: number; model: string; editedBy: string | null; generatedAt: Date; dossier: string };
function toJson(row: Row | null) {
  return {
    evalText: row?.evalText ?? "",
    aiText: row?.aiText ?? "",
    byteCount: row?.byteCount ?? 0,
    model: row?.model ?? "",
    editedBy: row?.editedBy ?? null,
    generatedAt: row?.generatedAt ?? null,
    hasDossier: !!row?.dossier,
  };
}

/** 현재 저장된 AI 세특 조회(스태프 전용). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const row = await prisma.mentoringAiEval.findUnique({ where: { courseId_studentId: { courseId, studentId: gate.studentId } } });
  return NextResponse.json(toJson(row));
}

/** 학생 활동 취합 → (선택)보고서 PDF 첨부 → Claude 로 세특 생성 → 저장(스태프 전용). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const body = (await request.json().catch(() => null)) as { studentId?: unknown; includeCommunity?: unknown; includeReportPdf?: unknown } | null;
  const gate = await gateAiEval(request, courseId, body?.studentId);
  if ("error" in gate) return gate.error;
  const { studentId } = gate;
  const includeCommunity = body?.includeCommunity !== false;
  const includeReportPdf = body?.includeReportPdf !== false;

  // 1) 활동 취합(외부 API 미사용)
  const dossier = await collectStudentDossier(courseId, studentId, { includeCommunity });

  // 2) 보고서 PDF 원본 첨부(있으면)
  let reportPdfBase64: string | undefined;
  if (includeReportPdf && dossier.hasReportPdf) {
    try {
      const ref = await getReportFileData(courseId, studentId);
      if (ref && (ref.mime === "application/pdf" || ref.name.toLowerCase().endsWith(".pdf"))) {
        const buf = await readUpload({ key: ref.key, data: ref.data });
        if (buf && buf.length < MAX_REPORT_PDF_BYTES) reportPdfBase64 = buf.toString("base64");
      }
    } catch {
      /* 보고서 첨부 실패는 무시하고 텍스트만으로 진행 */
    }
  }

  // 3) Claude 생성(2000바이트 미만 강제)
  const gen = await generateSete(dossier.text, reportPdfBase64);
  if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: 502 });

  // 4) 저장(생성 시 손수정 이력 초기화)
  const dossierStore = dossier.text.length > DOSSIER_STORE_CAP ? dossier.text.slice(0, DOSSIER_STORE_CAP) : dossier.text;
  const now = new Date();
  const row = await prisma.mentoringAiEval.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId, evalText: gen.text, aiText: gen.text, byteCount: gen.byteCount, dossier: dossierStore, model: gen.model, editedBy: null, generatedAt: now },
    update: { evalText: gen.text, aiText: gen.text, byteCount: gen.byteCount, dossier: dossierStore, model: gen.model, editedBy: null, generatedAt: now },
  });
  return NextResponse.json(toJson(row));
}
