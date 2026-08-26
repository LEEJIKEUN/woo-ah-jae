import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * dossier 텍스트 → 한글 PDF(관리자 다운로드). pdf-lib + fontkit + NanumGothic(서브셋 임베드).
 * pdf-lib 은 자동 줄바꿈이 없어 폭 기준으로 직접 줄바꿈한다(한글은 공백이 없어 문자 단위 분할 대비).
 */

// 리포지토리에 커밋된 정적 TTF(Docker 는 COPY . . 로 전체 복사 → runtime 에서 접근 가능).
const FONT_PATH = path.join(process.cwd(), "src/lib/mentoring/fonts/NanumGothic-Regular.ttf");
let fontBytesCache: Buffer | null = null;
function fontBytes(): Buffer {
  if (!fontBytesCache) fontBytesCache = fs.readFileSync(FONT_PATH);
  return fontBytesCache;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const MAX_PAGES = 40;

// 폭에 맞춰 한 문단을 여러 줄로 나눈다(공백 우선, 단일 토큰이 너무 길면 문자 단위).
function wrapParagraph(text: string, font: PDFFont, size: number): string[] {
  if (!text) return [""];
  const out: string[] = [];
  const pushWrappedToken = (token: string, line: string): string => {
    // 토큰 자체가 한 줄보다 넓으면 문자 단위로 쪼갠다(한글 대비)
    let cur = line;
    for (const ch of token) {
      const trial = cur + ch;
      if (font.widthOfTextAtSize(trial, size) > CONTENT_W && cur) {
        out.push(cur);
        cur = ch;
      } else {
        cur = trial;
      }
    }
    return cur;
  };
  let line = "";
  for (const word of text.split(/(\s+)/)) { // 공백도 토큰으로 보존
    if (word === "") continue;
    const trial = line + word;
    if (font.widthOfTextAtSize(trial, size) <= CONTENT_W) {
      line = trial;
    } else if (font.widthOfTextAtSize(word, size) > CONTENT_W) {
      if (line) { out.push(line); line = ""; }
      line = pushWrappedToken(word, line);
    } else {
      if (line.trim()) out.push(line.replace(/\s+$/, ""));
      line = word.replace(/^\s+/, "");
    }
  }
  if (line.trim() || out.length === 0) out.push(line.replace(/\s+$/, ""));
  return out;
}

export async function buildDossierPdf(opts: { title: string; dossierText: string }): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes(), { subset: true });

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageCount = 1;

  const newPage = () => {
    if (pageCount >= MAX_PAGES) return false;
    page = doc.addPage([PAGE_W, PAGE_H]);
    pageCount += 1;
    y = PAGE_H - MARGIN;
    return true;
  };

  const drawLine = (line: string, size: number, color = rgb(0.2, 0.2, 0.2)) => {
    const lh = font.heightAtSize(size) * 1.35;
    if (y - lh < MARGIN) { if (!newPage()) return false; }
    page.drawText(line, { x: MARGIN, y: y - font.heightAtSize(size), size, font, color });
    y -= lh;
    return true;
  };

  // 제목
  drawLine(opts.title, 15, rgb(0.32, 0.27, 0.22));
  y -= 6;

  outer: for (const rawLine of opts.dossierText.split("\n")) {
    if (pageCount >= MAX_PAGES && y - 20 < MARGIN) break;
    if (rawLine.trim() === "") { y -= 6; continue; }
    let size = 10.5;
    let color = rgb(0.2, 0.2, 0.2);
    let content = rawLine;
    if (rawLine.startsWith("# ")) { size = 14; color = rgb(0.32, 0.27, 0.22); content = rawLine.slice(2); }
    else if (rawLine.startsWith("## ")) { y -= 4; size = 12; color = rgb(0.42, 0.33, 0.25); content = rawLine.slice(3); }
    for (const line of wrapParagraph(content, font, size)) {
      if (!drawLine(line, size, color)) break outer;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
