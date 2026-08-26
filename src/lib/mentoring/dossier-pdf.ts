import { PdfWriter, rgb } from "@/lib/mentoring/pdf-util";
import type { DossierSection } from "@/lib/mentoring/dossier";

/**
 * ① 활동 정리 PDF(관리자 다운로드) — 학생 활동 원문을 요소별로 담고(항목별 소제목·구분선),
 * 마지막에 학생이 올린 원본 파일(탐구보고서·과제 PDF)을 그대로 이어붙여 '활동 전체 아카이브'로 만든다.
 * attachments 는 PDF 바이트만(동영상 등은 제외). 평가/AI 없음.
 */
const TITLE = rgb(0.28, 0.22, 0.16);
const H2 = rgb(0.42, 0.33, 0.25);
const MUTED = rgb(0.5, 0.5, 0.5);
const BODY = rgb(0.15, 0.15, 0.15);

export async function buildDossierPdf(opts: {
  title: string;
  subtitle?: string;
  sections?: DossierSection[];
  dossierText?: string;
  attachments?: { label: string; bytes: Buffer }[];
}): Promise<Buffer> {
  const w = await PdfWriter.create();

  // 표지 헤더
  w.para(opts.title, { size: 18, color: TITLE });
  if (opts.subtitle) w.para(opts.subtitle, { size: 10, color: MUTED, gapBefore: 3 });
  w.gap(3);
  w.rule(rgb(0.8, 0.75, 0.65));

  if (opts.sections?.length) {
    opts.sections.forEach((s, i) => {
      w.para(`${i + 1}. ${s.title}`, { size: 13, color: H2, gapBefore: 13 });
      w.rule();
      for (const line of s.body.split("\n")) {
        if (line.trim() === "") { w.gap(4); continue; }
        const indent = /^(-|\[|\d+\.|『)/.test(line.trim()) ? 8 : 0;
        w.para(line, { size: 10.5, color: BODY, gapBefore: 2, indent });
      }
    });
  } else {
    for (const line of (opts.dossierText ?? "").split("\n")) {
      if (line.trim() === "") { w.gap(5); continue; }
      if (line.startsWith("# ")) w.para(line.slice(2), { size: 14, color: TITLE, gapBefore: 4 });
      else if (line.startsWith("## ")) { w.para(line.slice(3), { size: 12, color: H2, gapBefore: 10 }); w.rule(); }
      else w.para(line, { size: 10.5, color: BODY, gapBefore: 2 });
    }
  }

  // 원본 파일 아카이브(탐구보고서·과제 PDF를 페이지 그대로 이어붙임)
  for (const att of opts.attachments ?? []) {
    await w.appendPdf(att.bytes, att.label);
  }

  return w.save();
}
