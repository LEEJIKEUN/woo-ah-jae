import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { r2Enabled } from "@/lib/private-file";
import { putPrivateObject } from "@/lib/r2";
import { buildDossierArchivePdf, buildEvalReportPdfFor, genStamp } from "@/lib/mentoring/gen-file";

export const dynamic = "force-dynamic";

type FileRow = { id: string; kind: string; label: string; createdAt: Date };
function toJson(f: FileRow) {
  return { id: f.id, kind: f.kind, label: f.label, createdAt: f.createdAt };
}

/** 저장된 생성 파일 목록(스태프 전용) — 새로고침·재접속 시 다운로드 탭 복원용. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const files = await prisma.mentoringGenFile.findMany({ where: { courseId, studentId: gate.studentId }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, label: true, createdAt: true } });
  return NextResponse.json({ files: files.map(toJson) });
}

/**
 * PDF 생성 → R2 저장 → 새 파일 반환(스태프 전용).
 * kind=dossier: 활동 정리(외부 API 미사용) / kind=report: 최종 평가 보고서(Claude 사용).
 * 저장본은 이후 다운로드에서 재생성 없이 서빙 → 추가 비용 없음.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const body = (await request.json().catch(() => null)) as { studentId?: unknown; kind?: unknown; includeCommunity?: unknown } | null;
  const gate = await gateAiEval(request, courseId, body?.studentId);
  if ("error" in gate) return gate.error;
  const { studentId } = gate;
  const kind = body?.kind === "report" ? "report" : body?.kind === "dossier" ? "dossier" : null;
  if (!kind) return NextResponse.json({ error: "종류가 올바르지 않습니다." }, { status: 400 });
  if (!r2Enabled()) return NextResponse.json({ error: "저장소(R2)가 설정되지 않았습니다." }, { status: 500 });
  const includeCommunity = body?.includeCommunity !== false;

  const built = kind === "report"
    ? await buildEvalReportPdfFor(courseId, studentId, includeCommunity)
    : await buildDossierArchivePdf(courseId, studentId, includeCommunity);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: kind === "report" ? 502 : 400 });

  const now = new Date();
  const key = `mentoring/${courseId}/${studentId}/genfiles/${kind}-${now.getTime()}-${crypto.randomUUID()}.pdf`;
  const fileKey = await putPrivateObject(key, built.pdf, "application/pdf");
  const f = await prisma.mentoringGenFile.create({ data: { courseId, studentId, kind, label: genStamp(now), fileKey, size: built.pdf.length, createdBy: gate.userId, createdAt: now } });
  return NextResponse.json(toJson(f));
}
