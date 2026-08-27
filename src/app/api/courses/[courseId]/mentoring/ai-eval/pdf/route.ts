import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { collectStudentDossier } from "@/lib/mentoring/dossier";
import { buildDossierPdf } from "@/lib/mentoring/dossier-pdf";
import { getReportFileData } from "@/lib/mentoring-store";
import { readUpload } from "@/lib/private-file";

export const dynamic = "force-dynamic";

const MAX_ATTACH_BYTES = 40 * 1024 * 1024; // 첨부 1개 상한
const MAX_ATTACH_COUNT = 12;

function isPdf(name: string, mime: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

/**
 * ① 활동 정리 PDF — 학생 활동 원문(요소별) + 학생이 올린 원본 파일(탐구보고서·과제 PDF)을 그대로 이어붙인
 * '활동 전체 아카이브'를 다운로드(스태프 전용). 항상 최신 데이터로 취합.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const gate = await gateAiEval(request, courseId, studentId);
  if ("error" in gate) return gate.error;

  const includeCommunity = url.searchParams.get("community") !== "0";
  const d = await collectStudentDossier(courseId, gate.studentId, { includeCommunity });
  if (!d.text.trim()) return new NextResponse("자료가 없습니다.", { status: 404 });

  // 원본 파일 첨부: 탐구보고서 PDF + 과제 PDF(동영상 제외)
  const attachments: { label: string; bytes: Buffer }[] = [];
  try {
    const rep = await getReportFileData(courseId, gate.studentId);
    if (rep && isPdf(rep.name, rep.mime)) {
      const buf = await readUpload({ key: rep.key, data: rep.data });
      if (buf && buf.length <= MAX_ATTACH_BYTES) attachments.push({ label: `첨부 원본 · 탐구 보고서 (${rep.name})`, bytes: buf });
    }
  } catch { /* 보고서 첨부 실패는 무시 */ }

  const asgs = await prisma.mentoringAssignment.findMany({ where: { courseId, studentId: gate.studentId }, orderBy: [{ column: "asc" }, { createdAt: "asc" }], select: { name: true, mime: true, fileKey: true, column: true } });
  for (const a of asgs) {
    if (attachments.length >= MAX_ATTACH_COUNT) break;
    if (!isPdf(a.name, a.mime)) continue; // 동영상 등은 본문 목록에만
    try {
      // 과제는 presign 업로드라 fileKey 가 원시 R2 키(r2:// 접두 없음) → 정규화해야 읽힌다
      const buf = await readUpload({ key: a.fileKey.startsWith("r2://") ? a.fileKey : `r2://${a.fileKey}` });
      if (buf && buf.length <= MAX_ATTACH_BYTES) attachments.push({ label: `첨부 원본 · 과제${a.column + 1} (${a.name})`, bytes: buf });
    } catch { /* 개별 첨부 실패는 건너뜀 */ }
  }

  let dateStr = "";
  try { dateStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }); } catch { /* noop */ }

  const pdf = await buildDossierPdf({
    title: `${d.studentName} 학생 활동 정리`,
    subtitle: `강좌 ${courseId}${dateStr ? ` · 생성 ${dateStr}` : ""} · 원본 첨부 ${attachments.length}건`,
    sections: d.sections,
    attachments,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`활동정리_${d.studentName}.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
