import { PdfWriter, rgb } from "@/lib/mentoring/pdf-util";
import type { DossierSection } from "@/lib/mentoring/dossier";
import type { EvalReport } from "@/lib/mentoring/eval-report";

/**
 * ③ 최종 평가 보고서 PDF — 요소별로 [원문 충실 재현] + [핵심요약·평가·피드백]을 나란히 담는다.
 * 원문은 dossier sections 에서, 평가는 eval-report 의 AI 결과에서 가져와 제목으로 매칭한다.
 */
const TITLE = rgb(0.28, 0.22, 0.16);
const H2 = rgb(0.42, 0.33, 0.25);
const MUTED = rgb(0.5, 0.5, 0.5);
const BODY = rgb(0.17, 0.17, 0.17);
const FEEDBACK = rgb(0.16, 0.36, 0.52); // 평가/피드백은 파란 계열로 원문과 시각 구분

export async function buildEvalReportPdf(opts: { studentName: string; courseId: string; sections: DossierSection[]; report: EvalReport; sete?: string }): Promise<Buffer> {
  const w = await PdfWriter.create();

  w.para(`${opts.studentName} 학생 — 최종 평가 보고서`, { size: 17, color: TITLE });
  w.para(`강좌 ${opts.courseId}`, { size: 10, color: MUTED, gapBefore: 2 });
  w.gap(8);

  if (opts.report.overall?.trim()) {
    w.para("■ 종합 총평", { size: 13, color: H2, gapBefore: 6 });
    w.para(opts.report.overall.trim(), { size: 10.5, color: BODY, gapBefore: 3 });
  }

  if (opts.sete?.trim()) {
    w.para("■ 세특(생기부 양식)", { size: 13, color: H2, gapBefore: 12 });
    w.para(opts.sete.trim(), { size: 10.5, color: BODY, gapBefore: 3 });
  }

  w.para("■ 요소별 원문 및 평가", { size: 13, color: H2, gapBefore: 14 });
  const fbByTitle = new Map(opts.report.sections.map((s) => [s.title, s]));
  for (const sec of opts.sections) {
    if (sec.body.trim() === "(없음)") continue;
    w.para(`◆ ${sec.title}`, { size: 12, color: TITLE, gapBefore: 12 });

    w.para("· 원문", { size: 9.5, color: MUTED, gapBefore: 4 });
    for (const line of sec.body.split("\n")) {
      if (line.trim() === "") { w.gap(3); continue; }
      w.para(line, { size: 10, color: BODY, gapBefore: 1, indent: 12 });
    }

    const fb = fbByTitle.get(sec.title);
    if (fb?.summary?.trim()) {
      w.para("· 핵심요약", { size: 9.5, color: MUTED, gapBefore: 7 });
      w.para(fb.summary.trim(), { size: 10, color: FEEDBACK, gapBefore: 1, indent: 12 });
    }
    if (fb?.feedback?.trim()) {
      w.para("· 평가·피드백", { size: 9.5, color: MUTED, gapBefore: 7 });
      w.para(fb.feedback.trim(), { size: 10, color: FEEDBACK, gapBefore: 1, indent: 12 });
    }
  }

  return w.save();
}
