import { prisma } from "@/lib/prisma";
import { collectStudentDossier } from "@/lib/mentoring/dossier";
import { buildDossierPdf } from "@/lib/mentoring/dossier-pdf";
import { buildEvalReportPdf } from "@/lib/mentoring/eval-report-pdf";
import { generateEvalFeedback } from "@/lib/mentoring/eval-report";
import { getReportFileData } from "@/lib/mentoring-store";
import { readUpload } from "@/lib/private-file";

/**
 * 생성해 저장할 PDF 빌더 — 활동 정리(원본 병합)·최종 평가 보고서(Claude).
 * files 라우트가 이 결과를 R2에 저장하고, 다운로드는 저장본을 서빙(재생성 없음).
 */
const MAX_ATTACH_BYTES = 40 * 1024 * 1024;
const MAX_ATTACH_COUNT = 12;
function isPdf(name: string, mime: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}
function r2Key(k: string) {
  return k.startsWith("r2://") ? k : `r2://${k}`;
}

/** 저장 파일 표시용 타임스탬프 — YYMMDD_HHMM(KST). */
export function genStamp(d: Date): string {
  try {
    const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    let hh = g("hour");
    if (hh === "24") hh = "00";
    return `${g("year")}${g("month")}${g("day")}_${hh}${g("minute")}`;
  } catch {
    return "";
  }
}

/** ① 활동 정리 PDF(요소별 요약 + 학생 업로드 원본 PDF 병합). 외부 API 미사용. */
export async function buildDossierArchivePdf(courseId: string, studentId: string, includeCommunity: boolean): Promise<{ ok: true; pdf: Buffer } | { ok: false; error: string }> {
  const d = await collectStudentDossier(courseId, studentId, { includeCommunity });
  if (!d.text.trim()) return { ok: false, error: "자료가 없습니다." };

  const attachments: { label: string; bytes: Buffer }[] = [];
  try {
    const rep = await getReportFileData(courseId, studentId);
    if (rep && isPdf(rep.name, rep.mime)) {
      const buf = await readUpload({ key: rep.key, data: rep.data });
      if (buf && buf.length <= MAX_ATTACH_BYTES) attachments.push({ label: `첨부 원본 · 탐구 보고서 (${rep.name})`, bytes: buf });
    }
  } catch {
    /* 보고서 첨부 실패는 무시 */
  }
  const asgs = await prisma.mentoringAssignment.findMany({ where: { courseId, studentId }, orderBy: [{ column: "asc" }, { createdAt: "asc" }], select: { name: true, mime: true, fileKey: true, column: true } });
  for (const a of asgs) {
    if (attachments.length >= MAX_ATTACH_COUNT) break;
    if (!isPdf(a.name, a.mime)) continue;
    try {
      const buf = await readUpload({ key: r2Key(a.fileKey) });
      if (buf && buf.length <= MAX_ATTACH_BYTES) attachments.push({ label: `첨부 원본 · 과제${a.column + 1} (${a.name})`, bytes: buf });
    } catch {
      /* 개별 첨부 실패는 건너뜀 */
    }
  }

  const pdf = await buildDossierPdf({ title: `${d.studentName} 학생 활동 정리`, subtitle: `강좌 ${courseId} · 원본 첨부 ${attachments.length}건`, sections: d.sections, attachments });
  return { ok: true, pdf };
}

/** ③ 최종 평가 보고서 PDF(요소별 원문 + AI 평가/피드백 + 세특). Claude 사용. */
export async function buildEvalReportPdfFor(courseId: string, studentId: string, includeCommunity: boolean): Promise<{ ok: true; pdf: Buffer } | { ok: false; error: string }> {
  const d = await collectStudentDossier(courseId, studentId, { includeCommunity, extractPdfText: true });
  if (!d.text.trim()) return { ok: false, error: "자료가 없습니다." };
  const titles = d.sections.filter((s) => s.body.trim() !== "(없음)").map((s) => s.title);
  const gen = await generateEvalFeedback(d.text, titles);
  if (!gen.ok) return { ok: false, error: gen.error };
  const row = await prisma.mentoringAiEval.findUnique({ where: { courseId_studentId: { courseId, studentId } }, select: { evalText: true } });
  const pdf = await buildEvalReportPdf({ studentName: d.studentName, courseId, sections: d.sections, report: gen.report, sete: row?.evalText ?? "" });
  return { ok: true, pdf };
}
