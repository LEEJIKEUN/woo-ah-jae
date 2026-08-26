import { prisma } from "@/lib/prisma";
import { byteLen, truncateToBytes } from "@/lib/mentoring/bytes";

/**
 * 학생이 우아재에서 남긴 모든 활동을 요소(섹션)별로 취합한다. 외부 API 미사용.
 * - sections: 요소별 원문(정리 PDF·최종 평가보고서에서 원문 그대로 보여줄 때 사용)
 * - text: 섹션을 이어붙인 단일 텍스트(세특/평가 생성 프롬프트 근거)
 * 파일 실제 바이트는 포함하지 않고 이름/메타만 나열한다(보고서 PDF 원본은 생성 단계에서 별도 첨부).
 */
export type DossierSection = { key: string; title: string; body: string };
export type DossierResult = { text: string; byteCount: number; hasReportPdf: boolean; studentName: string; sections: DossierSection[] };

const CAP_CHAT = 8 * 1024;
const CAP_BOARD = 6 * 1024;
const CAP_SECTION = 6 * 1024;
const CAP_TOTAL = 40 * 1024;
const MAX_CHAT_MSGS = 200;

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

/** 섹션 본문을 상한 내로 자르고, 비어 있으면 "(없음)". */
function capBody(body: string, cap = CAP_SECTION): string {
  const t = body.trim();
  if (!t) return "(없음)";
  const c = truncateToBytes(t, cap);
  return c.length < t.length ? `${c}\n…(이하 생략)` : c;
}

export async function collectStudentDossier(courseId: string, studentId: string, opts?: { includeCommunity?: boolean }): Promise<DossierResult> {
  const includeCommunity = opts?.includeCommunity ?? true;

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
  const sections: DossierSection[] = [];

  // 1) 탐구 보고서
  if (rep) {
    const lines: string[] = [];
    for (const [k, label] of REPORT_LABELS) {
      const v = (rep[k] as string) || "";
      if (v.trim()) lines.push(`- ${label}: ${v.trim()}`);
    }
    const stds = parseStandards(rep.standard || "");
    if (stds.length) lines.push(`- 선택한 성취기준: ${stds.map((s) => `${s.code ? `[${s.code}] ` : ""}${s.content}`).join(" / ")}`);
    if (hasReportPdf) lines.push(`- 첨부 보고서 파일: ${rep.fileName} (원본 PDF는 함께 첨부됨)`);
    sections.push({ key: "report", title: "탐구 보고서", body: capBody(lines.join("\n")) });
  } else {
    sections.push({ key: "report", title: "탐구 보고서", body: "(없음)" });
  }

  // 2) 독서활동
  sections.push({ key: "books", title: "독서활동", body: capBody(books.map((b, i) => {
    const bits = [b.book && `『${b.book}』`, b.author && `(${b.author})`].filter(Boolean).join(" ");
    const detail = [b.motive && `동기: ${b.motive}`, b.review && `감상: ${b.review}`, b.influence && `영향: ${b.influence}`].filter(Boolean).join(" / ");
    return `${i + 1}. ${bits}${detail ? ` — ${detail}` : ""}`;
  }).join("\n")) });

  // 3) 1:1 멘토링 채팅(텍스트만)
  sections.push({ key: "chat", title: "1:1 멘토링 대화", body: capBody(msgs.filter((m) => m.text.trim()).map((m) => `[${m.senderRole === "teacher" ? "교사" : "학생"}] ${m.text.trim()}`).join("\n"), CAP_CHAT) });

  // 4) 개별 공지
  sections.push({ key: "notice", title: "교사 개별 공지", body: capBody(notices.map((n) => `- ${n.body.trim()}`).join("\n")) });

  // 5) 제출 과제(이름/슬롯)
  sections.push({ key: "assignment", title: "제출 과제", body: capBody(assignments.map((a) => `- 과제${a.column + 1}: ${a.name}`).join("\n")) });

  // 6) 강좌 토론 게시판
  sections.push({ key: "board", title: "강좌 토론 게시판 활동", body: capBody([
    ...posts.map((p) => `[글] ${p.title}${p.body?.trim() ? `\n${p.body.trim()}` : ""}`),
    ...postComments.filter((c) => c.body.trim()).map((c) => `[댓글] ${c.body.trim()}`),
  ].join("\n\n"), CAP_BOARD) });

  // 7) 커뮤니티 게시판(강좌 외) — 옵션
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

  const header = `# ${studentName} 학생 활동 종합 (강좌 ${courseId})\n아래는 학생이 우아재에서 남긴 활동의 취합본이다. 여기에 없는 사실은 지어내지 않는다.\n`;
  let text = `${header}\n${sections.map((s) => `## ${s.title}\n${s.body}`).join("\n\n")}`;
  if (byteLen(text) > CAP_TOTAL) text = `${truncateToBytes(text, CAP_TOTAL)}\n…(전체 분량 초과로 일부 생략)`;

  return { text, byteCount: byteLen(text), hasReportPdf, studentName, sections };
}
