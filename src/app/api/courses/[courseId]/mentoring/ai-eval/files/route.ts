import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { r2Enabled } from "@/lib/private-file";
import { putPrivateObject } from "@/lib/r2";
import { buildDossierArchivePdf, buildEvalReportPdfFor, genStamp } from "@/lib/mentoring/gen-file";
import { DOSSIER_SECTION_KEYS, type DossierInclude } from "@/lib/mentoring/dossier";

export const dynamic = "force-dynamic";

type FileRow = { id: string; kind: string; label: string; createdAt: Date; sentAt?: Date | null };
function toJson(f: FileRow) {
  return { id: f.id, kind: f.kind, label: f.label, createdAt: f.createdAt, sentAt: f.sentAt ?? null };
}

/** 저장된 생성 파일 목록(스태프 전용) — 새로고침·재접속 시 다운로드 탭 복원용. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;
  const where = { courseId, studentId: gate.studentId };
  let files: FileRow[];
  try {
    files = await prisma.mentoringGenFile.findMany({ where, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, label: true, createdAt: true, sentAt: true } });
  } catch {
    // sentAt 컬럼 미적용 DB(배포 전) 폴백 — 보냄 상태만 비움
    files = await prisma.mentoringGenFile.findMany({ where, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, label: true, createdAt: true } });
  }
  return NextResponse.json({ files: files.map(toJson) });
}

/**
 * PDF 생성 → R2 저장 → 새 파일 반환(스태프 전용).
 * kind=dossier: 활동 정리(외부 API 미사용) / kind=report: 최종 평가 보고서(Claude 사용).
 * 저장본은 이후 다운로드에서 재생성 없이 서빙 → 추가 비용 없음.
 * dossier 는 include={sections, assignmentColumns} 로 담을 항목을 고를 수 있다(생략=전부). 라벨에 선택 요약이 붙는다.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const body = (await request.json().catch(() => null)) as { studentId?: unknown; kind?: unknown; includeCommunity?: unknown; include?: unknown } | null;
  const gate = await gateAiEval(request, courseId, body?.studentId);
  if ("error" in gate) return gate.error;
  const { studentId } = gate;
  const kind = body?.kind === "report" ? "report" : body?.kind === "dossier" ? "dossier" : null;
  if (!kind) return NextResponse.json({ error: "종류가 올바르지 않습니다." }, { status: 400 });
  if (!r2Enabled()) return NextResponse.json({ error: "저장소(R2)가 설정되지 않았습니다." }, { status: 500 });
  const includeCommunity = body?.includeCommunity !== false;

  // 정리 자료 포함 항목(선택) — 알 수 없는 키·범위 밖 슬롯은 버린다.
  let include: DossierInclude | undefined;
  if (kind === "dossier" && body?.include && typeof body.include === "object") {
    const raw = body.include as { sections?: unknown; assignmentColumns?: unknown };
    const known = DOSSIER_SECTION_KEYS as readonly string[];
    const sections = Array.isArray(raw.sections) ? raw.sections.filter((x): x is string => typeof x === "string" && known.includes(x)) : undefined;
    const assignmentColumns = Array.isArray(raw.assignmentColumns) ? raw.assignmentColumns.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 4) : undefined;
    if (sections?.length === 0 && assignmentColumns?.length === 0) return NextResponse.json({ error: "포함할 항목을 1개 이상 선택하세요." }, { status: 400 });
    include = { sections, assignmentColumns };
  }

  const built = kind === "report"
    ? await buildEvalReportPdfFor(courseId, studentId, includeCommunity)
    : await buildDossierArchivePdf(courseId, studentId, includeCommunity, include);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: kind === "report" ? 502 : 400 });

  const now = new Date();
  const key = `mentoring/${courseId}/${studentId}/genfiles/${kind}-${now.getTime()}-${crypto.randomUUID()}.pdf`;
  const fileKey = await putPrivateObject(key, built.pdf, "application/pdf");
  const summary = "summary" in built && built.summary ? ` · ${built.summary}` : "";
  const f = await prisma.mentoringGenFile.create({ data: { courseId, studentId, kind, label: `${genStamp(now)}${summary}`.slice(0, 120), fileKey, size: built.pdf.length, createdBy: gate.userId, createdAt: now } });
  return NextResponse.json(toJson(f));
}
