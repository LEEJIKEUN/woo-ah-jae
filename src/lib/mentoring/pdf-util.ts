import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** 한글 PDF 공통 유틸(pdf-lib + fontkit + NanumGothic 전체 임베드). 자동 줄바꿈 포함. */
export const PAGE_W = 595.28; // A4
export const PAGE_H = 841.89;
export const MARGIN = 50;
export const CONTENT_W = PAGE_W - MARGIN * 2;

// 리포지토리에 커밋된 정적 TTF(Docker COPY . . 로 runtime 접근 가능).
const FONT_PATH = path.join(process.cwd(), "src/lib/mentoring/fonts/NanumGothic-Regular.ttf");
let fontBytesCache: Buffer | null = null;
function fontBytes(): Buffer {
  if (!fontBytesCache) fontBytesCache = fs.readFileSync(FONT_PATH);
  return fontBytesCache;
}

/** 폭에 맞춰 한 문단을 여러 줄로(공백 우선, 단일 토큰이 너무 길면 문자 단위 — 한글 대비). */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth = CONTENT_W): string[] {
  if (!text) return [""];
  const out: string[] = [];
  const pushTok = (tok: string, ln: string): string => {
    let cur = ln;
    for (const ch of tok) {
      const t = cur + ch;
      if (font.widthOfTextAtSize(t, size) > maxWidth && cur) { out.push(cur); cur = ch; } else cur = t;
    }
    return cur;
  };
  let line = "";
  for (const w of text.split(/(\s+)/)) {
    if (w === "") continue;
    const t = line + w;
    if (font.widthOfTextAtSize(t, size) <= maxWidth) line = t;
    else if (font.widthOfTextAtSize(w, size) > maxWidth) { if (line) { out.push(line); line = ""; } line = pushTok(w, line); }
    else { if (line.trim()) out.push(line.replace(/\s+$/, "")); line = w.replace(/^\s+/, ""); }
  }
  if (line.trim() || out.length === 0) out.push(line.replace(/\s+$/, ""));
  return out;
}

type ParaOpts = { size?: number; color?: RGB; gapBefore?: number; indent?: number; maxPages?: number };
type TableOpts = { size?: number; widths?: number[]; indent?: number; gapBefore?: number; color?: RGB; lineColor?: RGB; headerBg?: RGB };

/** 페이지·커서를 관리하며 줄바꿈 문단을 순서대로 쓰는 라이터. */
export class PdfWriter {
  private constructor(private doc: PDFDocument, private font: PDFFont, private page: PDFPage, private y: number, private pageCount: number) {}

  static async create(): Promise<PdfWriter> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    // ⚠️ subset:true 금지 — pdf-lib 에 번들된 fontkit(1.1.1)이 NanumGothic 글리프를 재인코딩하며 glyf 데이터를 손상시켜
    //    뷰어(Preview·MuPDF 등)에서 한글 상당수가 빈칸으로 보였음(2026-11-04 확인). 폰트 전체(힌팅 제거 1.36MB)를 그대로 임베드한다.
    const font = await doc.embedFont(fontBytes(), { subset: false });
    const page = doc.addPage([PAGE_W, PAGE_H]);
    return new PdfWriter(doc, font, page, PAGE_H - MARGIN, 1);
  }

  gap(n: number) { this.y -= n; }

  /** 한 문단(자동 줄바꿈). 페이지가 넘치면 새 페이지. */
  para(text: string, opts: ParaOpts = {}) {
    const size = opts.size ?? 10.5;
    const color = opts.color ?? rgb(0.15, 0.15, 0.15);
    const x = MARGIN + (opts.indent ?? 0);
    const maxW = CONTENT_W - (opts.indent ?? 0);
    const maxPages = opts.maxPages ?? 60;
    if (opts.gapBefore) this.y -= opts.gapBefore;
    for (const line of wrapText(text, this.font, size, maxW)) {
      const lh = this.font.heightAtSize(size) * 1.5;
      if (this.y - lh < MARGIN) {
        if (this.pageCount >= maxPages) return;
        this.page = this.doc.addPage([PAGE_W, PAGE_H]);
        this.pageCount += 1;
        this.y = PAGE_H - MARGIN;
      }
      this.page.drawText(line, { x, y: this.y - this.font.heightAtSize(size), size, font: this.font, color });
      this.y -= lh;
    }
  }

  /**
   * 표 — 머리글 행 + 데이터 행. 셀 안 자동 줄바꿈, 행 단위로 페이지를 넘기며 새 페이지엔 머리글을 반복한다.
   * widths 는 열 너비 비율(합계 무관). 빈 셀은 "-" 로.
   */
  table(columns: string[], rows: string[][], opts: TableOpts = {}) {
    const size = opts.size ?? 9.5;
    const color = opts.color ?? rgb(0.15, 0.15, 0.15);
    const lineColor = opts.lineColor ?? rgb(0.85, 0.82, 0.75);
    const headerBg = opts.headerBg ?? rgb(0.975, 0.965, 0.945);
    const x0 = MARGIN + (opts.indent ?? 0);
    const totalW = CONTENT_W - (opts.indent ?? 0);
    const ratios = opts.widths && opts.widths.length === columns.length ? opts.widths : columns.map(() => 1);
    const sum = ratios.reduce((a, b) => a + b, 0);
    const widths = ratios.map((r) => (r / sum) * totalW);
    const padX = 4;
    const padY = 3.5;
    const fh = this.font.heightAtSize(size);
    const lh = fh * 1.35;
    if (opts.gapBefore) this.y -= opts.gapBefore;

    const layout = (cells: string[]) => {
      // 셀 안 명시적 줄바꿈(\n)은 줄 단위로 나눈 뒤 각 줄을 폭에 맞춰 다시 접는다(pdf-lib drawText 에 \n 을 넘기면 행 밖으로 흘러넘침)
      const lines = columns.map((_, i) => ((cells[i] ?? "").trim() || "-").split("\n").flatMap((seg) => wrapText(seg.trim(), this.font, size, widths[i] - padX * 2)));
      const h = Math.max(1, ...lines.map((l) => l.length)) * lh + padY * 2;
      return { lines, h };
    };
    const topLine = () => this.page.drawLine({ start: { x: x0, y: this.y }, end: { x: x0 + totalW, y: this.y }, thickness: 0.8, color: lineColor });
    const paint = (lines: string[][], h: number, header: boolean) => {
      const top = this.y;
      if (header) this.page.drawRectangle({ x: x0, y: top - h, width: totalW, height: h, color: headerBg });
      let cx = x0;
      lines.forEach((ls, i) => {
        ls.forEach((ln, j) => this.page.drawText(ln, { x: cx + padX, y: top - padY - fh - j * lh, size, font: this.font, color }));
        cx += widths[i];
      });
      this.page.drawLine({ start: { x: x0, y: top - h }, end: { x: x0 + totalW, y: top - h }, thickness: header ? 0.8 : 0.4, color: lineColor });
      this.y = top - h;
    };
    const head = layout(columns);
    if (this.y - head.h - lh < MARGIN) this.newPage();
    topLine();
    paint(head.lines, head.h, true);
    for (const r of rows) {
      const body = layout(r);
      if (this.y - body.h < MARGIN) {
        this.newPage();
        topLine();
        paint(head.lines, head.h, true);
      }
      paint(body.lines, body.h, false);
    }
    this.y -= 4;
  }

  /** 현재 위치에 가로 구분선. */
  rule(color: RGB = rgb(0.85, 0.82, 0.75)) {
    const lh = 8;
    if (this.y - lh < MARGIN) { this.page = this.doc.addPage([PAGE_W, PAGE_H]); this.pageCount += 1; this.y = PAGE_H - MARGIN; }
    this.page.drawLine({ start: { x: MARGIN, y: this.y - 3 }, end: { x: PAGE_W - MARGIN, y: this.y - 3 }, thickness: 0.7, color });
    this.y -= lh;
  }

  /** 새 페이지 시작(제목/구분면 용). */
  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageCount += 1;
    this.y = PAGE_H - MARGIN;
  }

  /**
   * 다른 PDF(원본 첨부)의 페이지를 이 문서 뒤에 그대로 이어붙인다.
   * 별도 빈 라벨 페이지를 만들지 않고, 원본 '첫 페이지 상단'에 라벨을 얹어 원본이 그 페이지부터 시작되게 한다.
   */
  async appendPdf(bytes: Buffer, label: string, maxPages = 40) {
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const idxs = src.getPageIndices().slice(0, maxPages);
      const copied = await this.doc.copyPages(src, idxs);
      copied.forEach((p, i) => {
        this.doc.addPage(p);
        this.pageCount += 1;
        if (i === 0) {
          // 원본 첫 페이지 상단 여백에 라벨 스탬프(원본 내용과 안 겹치게 얇은 흰 배경)
          const size = 8;
          const { width, height } = p.getSize();
          const tw = Math.min(this.font.widthOfTextAtSize(label, size), width - 40);
          p.drawRectangle({ x: 16, y: height - 15, width: tw + 14, height: 13, color: rgb(1, 1, 1), opacity: 0.9, borderColor: rgb(0.85, 0.82, 0.75), borderWidth: 0.5 });
          p.drawText(label, { x: 22, y: height - 12, size, font: this.font, color: rgb(0.42, 0.33, 0.25), maxWidth: width - 44 });
        }
      });
      if (total > maxPages) {
        this.newPage();
        this.para(`… 이 첨부는 ${maxPages}페이지까지만 포함했습니다(원본 ${total}페이지).`, { size: 10, color: rgb(0.5, 0.5, 0.5) });
      }
    } catch {
      this.newPage();
      this.para(`${label} — (이 파일은 PDF로 불러오지 못해 원본을 첨부하지 못했습니다.)`, { size: 10, color: rgb(0.6, 0.3, 0.2) });
    }
  }

  async save(): Promise<Buffer> {
    return Buffer.from(await this.doc.save());
  }
}

export { rgb };
