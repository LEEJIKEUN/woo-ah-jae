import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** 한글 PDF 공통 유틸(pdf-lib + fontkit + NanumGothic 서브셋). 자동 줄바꿈 포함. */
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

/** 페이지·커서를 관리하며 줄바꿈 문단을 순서대로 쓰는 라이터. */
export class PdfWriter {
  private constructor(private doc: PDFDocument, private font: PDFFont, private page: PDFPage, private y: number, private pageCount: number) {}

  static async create(): Promise<PdfWriter> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(fontBytes(), { subset: true });
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

  async save(): Promise<Buffer> {
    return Buffer.from(await this.doc.save());
  }
}

export { rgb };
