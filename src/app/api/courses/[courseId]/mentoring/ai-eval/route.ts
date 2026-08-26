import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { collectStudentDossier } from "@/lib/mentoring/dossier";
import { generateSete } from "@/lib/mentoring/generate-sete";

export const dynamic = "force-dynamic";

const DOSSIER_STORE_CAP = 60 * 1024; // 저장 스냅샷 상한(재생성·근거용)

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

/**
 * 학생 활동 취합(업로드 PDF 원문 텍스트 포함) → 정리본 텍스트 단일 소스를 Claude 로 읽혀 세특 생성 → 저장.
 * 스태프 전용. 이미지/PDF 페이지 토큰 없이 텍스트로만 보내 저렴.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const body = (await request.json().catch(() => null)) as { studentId?: unknown; includeCommunity?: unknown } | null;
  const gate = await gateAiEval(request, courseId, body?.studentId);
  if ("error" in gate) return gate.error;
  const { studentId } = gate;
  const includeCommunity = body?.includeCommunity !== false;

  // 1) 활동 취합(외부 API 미사용) + 업로드 PDF 원문 텍스트 추출 → 단일 정리본 텍스트
  const dossier = await collectStudentDossier(courseId, studentId, { includeCommunity, extractPdfText: true });

  // 2) 정리본 텍스트만 Claude 로 읽혀 세특 생성(2000바이트 미만 강제)
  const gen = await generateSete(dossier.text);
  if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: 502 });

  // 3) 저장(생성 시 손수정 이력 초기화)
  const dossierStore = dossier.text.length > DOSSIER_STORE_CAP ? dossier.text.slice(0, DOSSIER_STORE_CAP) : dossier.text;
  const now = new Date();
  const row = await prisma.mentoringAiEval.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId, evalText: gen.text, aiText: gen.text, byteCount: gen.byteCount, dossier: dossierStore, model: gen.model, editedBy: null, generatedAt: now },
    update: { evalText: gen.text, aiText: gen.text, byteCount: gen.byteCount, dossier: dossierStore, model: gen.model, editedBy: null, generatedAt: now },
  });
  return NextResponse.json(toJson(row));
}
