import { PDFDocument } from "pdf-lib";

/** 앞 n페이지만 남긴 PDF 버퍼. n이 전체 이상이면 null(자를 필요 없음). */
export async function trimPdfToPages(bytes: Buffer, n: number): Promise<Buffer | null> {
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  if (n >= total) return null;
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: Math.max(1, n) }, (_, i) => i));
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}
