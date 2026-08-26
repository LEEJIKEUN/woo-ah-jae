import { PdfWriter, rgb } from "@/lib/mentoring/pdf-util";
import type { DossierSection } from "@/lib/mentoring/dossier";

/**
 * ① 활동 정리 PDF(관리자 다운로드) — 학생 활동 원문을 요소별로 그대로 담는다. 평가/AI 없음.
 * sections 가 있으면 요소별로, 없으면 dossierText 를 줄 단위로 렌더.
 */
const H1 = rgb(0.32, 0.27, 0.22);
const H2 = rgb(0.42, 0.33, 0.25);
const BODY = rgb(0.15, 0.15, 0.15);

export async function buildDossierPdf(opts: { title: string; dossierText?: string; sections?: DossierSection[] }): Promise<Buffer> {
  const w = await PdfWriter.create();
  w.para(opts.title, { size: 16, color: H1, gapBefore: 2 });
  w.gap(6);

  if (opts.sections && opts.sections.length) {
    for (const s of opts.sections) {
      w.para(s.title, { size: 13, color: H2, gapBefore: 10 });
      for (const line of s.body.split("\n")) {
        if (line.trim() === "") { w.gap(4); continue; }
        w.para(line, { size: 10.5, color: BODY, gapBefore: 2 });
      }
    }
  } else {
    for (const line of (opts.dossierText ?? "").split("\n")) {
      if (line.trim() === "") { w.gap(5); continue; }
      if (line.startsWith("# ")) w.para(line.slice(2), { size: 14, color: H1, gapBefore: 4 });
      else if (line.startsWith("## ")) w.para(line.slice(3), { size: 12, color: H2, gapBefore: 8 });
      else w.para(line, { size: 10.5, color: BODY, gapBefore: 2 });
    }
  }
  return w.save();
}
