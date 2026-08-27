import { prisma } from "@/lib/prisma";
import { byteLen, truncateToBytes } from "@/lib/mentoring/bytes";
import { readUpload } from "@/lib/private-file";
import { getReportFileData } from "@/lib/mentoring-store";
import { extractPdfText } from "@/lib/mentoring/pdf-text";

/**
 * 학생이 우아재에서 남긴 모든 활동을 요소(섹션)별로 취합한다. 외부 API 미사용.
 * - sections: 요소별 원문(정리 PDF 렌더용)
 * - text: 섹션을 이어붙인 단일 텍스트 — AI 세특/평가는 이 텍스트 하나만 읽는다(단일 소스).
 * opts.extractPdfText=true 이면 업로드한 보고서·과제 PDF의 '텍스트'를 추출해 정리본에 포함한다
 * (스캔본 등 추출 불가 시 안내 문구만). AI 입력용 취합에서만 켠다.
 */
export type DossierSection = { key: string; title: string; body: string };
export type DossierResult = { text: string; byteCount: number; hasReportPdf: boolean; studentName: string; sections: DossierSection[] };

const CAP_CHAT = 8 * 1024;
const CAP_BOARD = 6 * 1024;
const CAP_SECTION = 6 * 1024;
const CAP_REPORT_FILE = 12 * 1024;
const CAP_ASSIGN_FILE = 16 * 1024;
const CAP_TOTAL = 48 * 1024;
const MAX_CHAT_MSGS = 200;
const MAX_ATTACH_BYTES = 30 * 1024 * 1024;
const MAX_ASSIGN_EXTRACT = 5;

const REPORT_LABELS: [keyof ReportRow, string][] = [
  ["topic", "주제"], ["motive", "동기"], ["process", "과정"], ["result", "결과"],
  ["difficulty", "어려움"], ["overcome", "극복"], ["learned", "배운 점"], ["references", "참고문헌"],
];
type ReportRow = { topic: string; motive: string; process: string; result: string; difficulty: string; overcome: string; learned: string; standard: string; references: string };

function parseStandards(v: string): { code: string; content: string }[] {
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a.filter((x) => x && typeof x.content === "string").map((x) => ({ code: String(x.code ?? ""), content: String(x.content) })) : [];
  } catch {
    return [];
  }
}

function isPdf(name: string, mime: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

function capBody(body: string, cap = CAP_SECTION): string {
  const t = body.trim();
  if (!t) return "(없음)";
  const c = truncateToBytes(t, cap);
  return c.length < t.length ? `${c}\n…(이하 생략)` : c;
}

export async function collectStudentDossier(courseId: string, studentId: string, opts?: { includeCommunity?: boolean; extractPdfText?: boolean; maxTotalBytes?: number }): Promise<DossierResult> {
  const includeCommunity = opts?.includeCommunity ?? true;
  const doExtract = opts?.extractPdfText ?? false;
  // AI 입력(text)의 전체 상한. 기본 48KB. 평가 보고서는 지연(TTFT) 단축을 위해 더 작게 넘긴다.
  // 참고: sections(원문 렌더용)는 이 상한과 무관하게 항상 전량 유지된다.
  const totalCap = Math.max(8 * 1024, opts?.maxTotalBytes ?? CAP_TOTAL);

  const [user, rep, books, msgs, notices, assignments, standards, posts, postComments] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: { studentProfile: { select: { realName: true } } } }),
    prisma.mentoringReport.findUnique({ where: { courseId_studentId: { courseId, studentId } } }),
    prisma.mentoringBook.findMany({ where: { courseId, studentId }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringMessage.findMany({ where: { courseId, studentId, deletedAt: null }, orderBy: { createdAt: "asc" }, take: -MAX_CHAT_MSGS }),
    prisma.mentoringNotice.findMany({ where: { courseId, studentId }, orderBy: { createdAt: "asc" } }),
    prisma.mentoringAssignment.findMany({ where: { courseId, studentId }, orderBy: [{ column: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringAchievementStandard.findMany({ where: { courseId }, orderBy: { sort: "asc" }, select: { area: true, code: true, content: true } }),
    prisma.coursePost.findMany({ where: { courseId, authorId: studentId, kind: "DISCUSSION" }, orderBy: { createdAt: "asc" }, select: { title: true, body: true } }),
    prisma.coursePostComment.findMany({ where: { authorId: studentId, post: { courseId } }, orderBy: { createdAt: "asc" }, select: { body: true } }),
  ]);

  const studentName = user?.studentProfile?.realName ?? "학생";
  const hasReportPdf = !!(rep?.fileName && (rep.fileData || rep.fileKey));

  // 업로드 PDF 텍스트 추출(AI 입력용일 때만) — 정리본 단일 소스에 포함
  let reportFileText = "";
  let assignmentText = "";
  if (doExtract) {
    if (hasReportPdf) {
      try {
        const ref = await getReportFileData(courseId, studentId);
        if (ref && isPdf(ref.name, ref.mime)) {
          const buf = await readUpload({ key: ref.key, data: ref.data });
          if (buf && buf.length <= MAX_ATTACH_BYTES) reportFileText = await extractPdfText(buf, 10000);
          if (!reportFileText) reportFileText = `(첨부 '${ref.name}'에서 텍스트를 추출하지 못했습니다 — 스캔본 등일 수 있음)`;
        }
      } catch {
        /* 추출 실패는 무시 */
      }
    }
    const parts: string[] = [];
    let n = 0;
    for (const a of assignments) {
      if (n >= MAX_ASSIGN_EXTRACT) break;
      if (!isPdf(a.name, a.mime)) continue; // 동영상 등은 원문 추출 대상 아님
      try {
        // 과제는 presign 업로드라 fileKey 가 원시 R2 키(r2:// 접두 없음) → 정규화해야 읽힌다
        const buf = await readUpload({ key: a.fileKey.startsWith("r2://") ? a.fileKey : `r2://${a.fileKey}` });
        if (!buf || buf.length > MAX_ATTACH_BYTES) continue;
        const t = await extractPdfText(buf, 6000);
        parts.push(t ? `[과제${a.column + 1}: ${a.name}]\n${t}` : `[과제${a.column + 1}: ${a.name}] (텍스트 추출 불가 — 스캔본 등)`);
        n += 1;
      } catch {
        /* 개별 실패는 건너뜀 */
      }
    }
    assignmentText = parts.join("\n\n");
  }

  const sections: DossierSection[] = [];

  // 1) 탐구 보고서(입력 필드)
  if (rep) {
    const lines: string[] = [];
    for (const [k, label] of REPORT_LABELS) {
      const v = (rep[k] as string) || "";
      if (v.trim()) lines.push(`- ${label}: ${v.trim()}`);
    }
    const stds = parseStandards(rep.standard || "");
    if (stds.length) lines.push(`- 선택한 성취기준: ${stds.map((s) => `${s.code ? `[${s.code}] ` : ""}${s.content}`).join(" / ")}`);
    if (hasReportPdf) lines.push(`- 첨부 보고서 파일: ${rep.fileName}`);
    sections.push({ key: "report", title: "탐구 보고서", body: capBody(lines.join("\n")) });
  } else {
    sections.push({ key: "report", title: "탐구 보고서", body: "(없음)" });
  }
  // 1-1) 보고서 첨부 원문(추출)
  if (doExtract && reportFileText) sections.push({ key: "report_file", title: "탐구 보고서 첨부 원문(추출)", body: capBody(reportFileText, CAP_REPORT_FILE) });

  // 2) 독서활동
  sections.push({ key: "books", title: "독서활동", body: capBody(books.map((b, i) => {
    const bits = [b.book && `『${b.book}』`, b.author && `(${b.author})`].filter(Boolean).join(" ");
    const detail = [b.motive && `동기: ${b.motive}`, b.review && `감상: ${b.review}`, b.influence && `영향: ${b.influence}`].filter(Boolean).join(" / ");
    return `${i + 1}. ${bits}${detail ? ` — ${detail}` : ""}`;
  }).join("\n")) });

  // 3) 1:1 멘토링 채팅
  sections.push({ key: "chat", title: "1:1 멘토링 대화", body: capBody(msgs.filter((m) => m.text.trim()).map((m) => `[${m.senderRole === "teacher" ? "교사" : "학생"}] ${m.text.trim()}`).join("\n"), CAP_CHAT) });

  // 4) 개별 공지
  sections.push({ key: "notice", title: "교사 개별 공지", body: capBody(notices.map((no) => `- ${no.body.trim()}`).join("\n")) });

  // 5) 제출 과제(이름/슬롯)
  sections.push({ key: "assignment", title: "제출 과제", body: capBody(assignments.map((a) => `- 과제${a.column + 1}: ${a.name}`).join("\n")) });
  // 5-1) 과제 원문(추출)
  if (doExtract && assignmentText) sections.push({ key: "assignment_file", title: "제출 과제 원문(추출)", body: capBody(assignmentText, CAP_ASSIGN_FILE) });

  // 6) 강좌 토론 게시판
  sections.push({ key: "board", title: "강좌 토론 게시판 활동", body: capBody([
    ...posts.map((p) => `[글] ${p.title}${p.body?.trim() ? `\n${p.body.trim()}` : ""}`),
    ...postComments.filter((c) => c.body.trim()).map((c) => `[댓글] ${c.body.trim()}`),
  ].join("\n\n"), CAP_BOARD) });

  // 7) 커뮤니티 게시판(옵션)
  if (includeCommunity) {
    const [cPosts, cComments] = await Promise.all([
      prisma.boardPost.findMany({ where: { authorId: studentId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { title: true, content: true } }),
      prisma.boardComment.findMany({ where: { authorId: studentId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { content: true } }),
    ]);
    sections.push({ key: "community", title: "커뮤니티 게시판 활동 (강좌 외 포함 — 참고용)", body: capBody([
      ...cPosts.map((p) => `[글] ${p.title}${p.content?.trim() ? `\n${p.content.trim()}` : ""}`),
      ...cComments.filter((c) => c.content.trim()).map((c) => `[댓글] ${c.content.trim()}`),
    ].join("\n\n"), CAP_BOARD) });
  }

  // 8) 강좌 성취기준(맥락)
  sections.push({ key: "standards", title: "강좌 성취기준(참고)", body: capBody(standards.map((s) => `- ${s.area ? `[${s.area}] ` : ""}${s.code ? `${s.code} ` : ""}${s.content}`).join("\n")) });

  const header = `# ${studentName} 학생 활동 종합 (강좌 ${courseId})\n아래는 학생이 우아재에서 남긴 활동의 취합본이다(업로드 문서 원문 포함). 여기에 없는 사실은 지어내지 않는다.\n`;
  let text = `${header}\n${sections.map((s) => `## ${s.title}\n${s.body}`).join("\n\n")}`;
  if (byteLen(text) > totalCap) text = `${truncateToBytes(text, totalCap)}\n…(전체 분량 초과로 일부 생략)`;

  return { text, byteCount: byteLen(text), hasReportPdf, studentName, sections };
}
