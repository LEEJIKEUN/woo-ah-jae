import { prisma } from "@/lib/prisma";
import { byteLen, truncateToBytes } from "@/lib/mentoring/bytes";

/**
 * 학생이 우아재에서 남긴 모든 활동을 하나의 dossier(구조화 텍스트)로 취합한다. 외부 API 미사용.
 * AI 세특 생성의 근거이자 관리자 다운로드 PDF의 원본. (courseId, studentId) 기준.
 * 파일 실제 바이트는 포함하지 않고 이름/메타만 나열한다(보고서 PDF 원본은 생성 단계에서 별도 첨부).
 */
export type DossierResult = { text: string; byteCount: number; hasReportPdf: boolean; studentName: string };

// 소스별/전체 크기 상한(UTF-8 바이트). Render 타임아웃·토큰 비용 방어.
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

/** 섹션 텍스트를 상한 내로 만들고, 비어 있으면 "(없음)" 표기. */
function section(title: string, body: string, cap = CAP_SECTION): string {
  const trimmed = body.trim();
  if (!trimmed) return `## ${title}\n(없음)\n`;
  const capped = truncateToBytes(trimmed, cap);
  const suffix = capped.length < trimmed.length ? "\n…(이하 생략)" : "";
  return `## ${title}\n${capped}${suffix}\n`;
}

export async function collectStudentDossier(courseId: string, studentId: string, opts?: { includeCommunity?: boolean }): Promise<DossierResult> {
  const includeCommunity = opts?.includeCommunity ?? true;

  const [user, rep, books, msgs, notices, assignments, standards] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: { studentProfile: { select: { realName: true } } } }),
    prisma.mentoringReport.findUnique({ where: { courseId_studentId: { courseId, studentId } } }),
    prisma.mentoringBook.findMany({ where: { courseId, studentId }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringMessage.findMany({ where: { courseId, studentId, deletedAt: null }, orderBy: { createdAt: "asc" }, take: -MAX_CHAT_MSGS }),
    prisma.mentoringNotice.findMany({ where: { courseId, studentId }, orderBy: { createdAt: "asc" } }),
    prisma.mentoringAssignment.findMany({ where: { courseId, studentId }, orderBy: [{ column: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringAchievementStandard.findMany({ where: { courseId }, orderBy: { sort: "asc" }, select: { area: true, code: true, content: true } }),
  ]);

  // 강좌 토론 게시판 — 학생 작성 글/댓글
  const posts = await prisma.coursePost.findMany({ where: { courseId, authorId: studentId, kind: "DISCUSSION" }, orderBy: { createdAt: "asc" }, select: { title: true, body: true } });
  const postComments = await prisma.coursePostComment.findMany({ where: { authorId: studentId, post: { courseId } }, orderBy: { createdAt: "asc" }, select: { body: true } });

  const studentName = user?.studentProfile?.realName ?? "학생";
  const hasReportPdf = !!(rep?.fileName && (rep.fileData || rep.fileKey));

  const parts: string[] = [];
  parts.push(`# ${studentName} 학생 활동 종합 (강좌 ${courseId})`);
  parts.push("아래는 학생이 우아재에서 남긴 활동의 취합본이다. 세특 작성의 근거 자료로만 쓰고, 여기에 없는 사실은 지어내지 않는다.\n");

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
    parts.push(section("탐구 보고서", lines.join("\n")));
  } else {
    parts.push(section("탐구 보고서", ""));
  }

  // 2) 독서활동
  parts.push(section("독서활동", books.map((b, i) => {
    const bits = [b.book && `『${b.book}』`, b.author && `(${b.author})`].filter(Boolean).join(" ");
    const detail = [b.motive && `동기: ${b.motive}`, b.review && `감상: ${b.review}`, b.influence && `영향: ${b.influence}`].filter(Boolean).join(" / ");
    return `${i + 1}. ${bits}${detail ? ` — ${detail}` : ""}`;
  }).join("\n")));

  // 3) 1:1 멘토링 채팅(텍스트만, 삭제 제외)
  parts.push(section("1:1 멘토링 대화", msgs.filter((m) => m.text.trim()).map((m) => `[${m.senderRole === "teacher" ? "교사" : "학생"}] ${m.text.trim()}`).join("\n"), CAP_CHAT));

  // 4) 개별 공지(교사가 학생에게)
  parts.push(section("교사 개별 공지", notices.map((n) => `- ${n.body.trim()}`).join("\n")));

  // 5) 제출 과제 목록(이름/슬롯)
  parts.push(section("제출 과제", assignments.map((a) => `- 과제${a.column + 1}: ${a.name}`).join("\n")));

  // 6) 강좌 토론 게시판(학생 글/댓글)
  const boardText = [
    ...posts.map((p) => `[글] ${p.title}${p.body?.trim() ? `\n${p.body.trim()}` : ""}`),
    ...postComments.filter((c) => c.body.trim()).map((c) => `[댓글] ${c.body.trim()}`),
  ].join("\n\n");
  parts.push(section("강좌 토론 게시판 활동", boardText, CAP_BOARD));

  // 7) 커뮤니티 게시판(강좌 외 포함) — 옵션
  if (includeCommunity) {
    const [cPosts, cComments] = await Promise.all([
      prisma.boardPost.findMany({ where: { authorId: studentId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { title: true, content: true } }),
      prisma.boardComment.findMany({ where: { authorId: studentId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { content: true } }),
    ]);
    const cText = [
      ...cPosts.map((p) => `[글] ${p.title}${p.content?.trim() ? `\n${p.content.trim()}` : ""}`),
      ...cComments.filter((c) => c.content.trim()).map((c) => `[댓글] ${c.content.trim()}`),
    ].join("\n\n");
    parts.push(section("커뮤니티 게시판 활동 (강좌 외 포함 — 참고용)", cText, CAP_BOARD));
  }

  // 8) 해당 강좌 성취기준(맥락)
  parts.push(section("강좌 성취기준(참고)", standards.map((s) => `- ${s.area ? `[${s.area}] ` : ""}${s.code ? `${s.code} ` : ""}${s.content}`).join("\n")));

  let text = parts.join("\n");
  if (byteLen(text) > CAP_TOTAL) text = truncateToBytes(text, CAP_TOTAL) + "\n…(전체 분량 초과로 일부 생략)";

  return { text, byteCount: byteLen(text), hasReportPdf, studentName };
}
