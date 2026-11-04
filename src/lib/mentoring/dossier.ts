import { prisma } from "@/lib/prisma";
import { byteLen, truncateToBytes } from "@/lib/mentoring/bytes";
import { readUpload } from "@/lib/private-file";
import { getReportFileData } from "@/lib/mentoring-store";
import { extractPdfText } from "@/lib/mentoring/pdf-text";
import { formatExamSection, loadExamRows, type ExamRow } from "@/lib/mentoring/exam-summary";

/**
 * 학생이 우아재에서 남긴 모든 활동을 요소(섹션)별로 취합한다. 외부 API 미사용.
 * - sections: 요소별 원문 — 활동 정리 PDF·최종 평가 보고서 PDF 렌더용. **자르지 않고 전량** 담는다.
 * - text: 섹션을 이어붙인 단일 텍스트 — AI 세특/평가는 이 텍스트 하나만 읽는다(단일 소스).
 *   지연·토큰 관리를 위해 섹션별 상한(AI_CAPS)과 전체 상한(maxTotalBytes)을 적용하고, 잘린 경우 본문에 표기한다.
 * opts.extractPdfText=true 이면 업로드한 보고서·과제 PDF의 '텍스트'를 추출해 정리본에 포함한다
 * (스캔본 등 추출 불가 시 안내 문구만). AI 입력용 취합에서만 켠다.
 */
export type DossierSection = { key: string; title: string; body: string };
export type DossierResult = { text: string; byteCount: number; hasReportPdf: boolean; studentName: string; sections: DossierSection[] };

/**
 * 정리 자료에 담을 항목 선택(활동 정리 PDF 전용). 생략하면 전부 포함.
 * - sections: 포함할 섹션 키(DOSSIER_SECTION_KEYS 중). 'report_file'은 탐구 보고서 원본 PDF 첨부(+AI 모드에선 추출 원문).
 * - assignmentColumns: 포함할 과제 슬롯(0=과제1 … 4=과제5). 목록·원본 추출·원본 첨부 모두 이 슬롯만. 빈 배열이면 과제 섹션 제외.
 */
export type DossierInclude = { sections?: string[]; assignmentColumns?: number[] };
export const DOSSIER_SECTION_KEYS = ["report", "report_file", "books", "chat", "board", "exam", "standards"] as const;
const SECTION_SHORT: Record<string, string> = { report: "보고서", report_file: "보고서원본", books: "독서", chat: "대화", board: "게시판", exam: "시험", standards: "성취기준" };

/** 과제 슬롯 → "3-5" / "1,3,5" 같은 짧은 표기. */
function colRange(cols: number[]): string {
  const c = [...new Set(cols)].sort((a, b) => a - b).map((x) => x + 1);
  if (!c.length) return "";
  const contiguous = c.every((v, i) => i === 0 || v === c[i - 1] + 1);
  return contiguous && c.length > 1 ? `${c[0]}-${c[c.length - 1]}` : c.join(",");
}

/**
 * 선택 내용을 짧은 라벨로 — 전부 포함이면 "". 실제 존재하는 항목(제출된 과제·첨부된 보고서) 기준으로 '전부'를 판정한다.
 * 예: "과제3-5" / "보고서·게시판·과제1-5" / "보고서·과제없음"
 */
export function dossierIncludeSummary(inc: DossierInclude | undefined, ctx: { submittedColumns: number[]; hasReportFile: boolean }): string {
  if (!inc) return "";
  const relevantKeys = DOSSIER_SECTION_KEYS.filter((k) => k !== "report_file" || ctx.hasReportFile);
  const secIn = (k: string) => !inc.sections || inc.sections.includes(k);
  const colIn = (c: number) => !inc.assignmentColumns || inc.assignmentColumns.includes(c);
  const secPart = !relevantKeys.every(secIn);
  const colPart = !ctx.submittedColumns.every(colIn);
  if (!secPart && !colPart) return "";
  const parts: string[] = [];
  if (secPart) for (const k of relevantKeys) if (secIn(k)) parts.push(SECTION_SHORT[k]);
  const cols = ctx.submittedColumns.filter(colIn);
  parts.push(cols.length ? `과제${colRange(cols)}` : "과제없음");
  return parts.join("·");
}

// ── AI 입력(text) 전용 상한. sections(원문)에는 적용하지 않는다. ──
const CAP_SECTION = 6 * 1024;
const CAP_CHAT = 8 * 1024;
// 토론 게시판: 학생당 댓글이 10~25KB(상호 피드백 댓글 포함) 규모. 6KB 였을 때 뒤쪽(=상호 피드백)이 통째로 잘렸음.
const CAP_BOARD = 24 * 1024;
const CAP_REPORT_FILE = 12 * 1024;
const CAP_ASSIGN_FILE = 16 * 1024;
const CAP_TOTAL = 64 * 1024;
const AI_CAPS: Record<string, number> = {
  chat: CAP_CHAT,
  board: CAP_BOARD,
  report_file: CAP_REPORT_FILE,
  assignment_file: CAP_ASSIGN_FILE,
};
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

/** 원문 섹션 본문 — 비어 있으면 "(없음)". 자르지 않는다. */
function fullBody(body: string): string {
  const t = body.trim();
  return t ? t : "(없음)";
}

/** AI 입력용 본문 — 섹션별 바이트 상한으로 자르고, 잘렸음을 표기(원문 sections 는 전량 유지). */
function aiBody(key: string, body: string): string {
  const t = body.trim();
  if (!t || t === "(없음)") return "(없음)";
  const cap = AI_CAPS[key] ?? CAP_SECTION;
  const c = truncateToBytes(t, cap);
  return c.length < t.length ? `${c}\n…(이하 생략 — 활동 정리 PDF에는 전량 수록)` : c;
}

/** KST 기준 M/D. */
function fmtDay(d: Date): string {
  try {
    const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    return `${g("month")}/${g("day")}`;
  } catch {
    return "";
  }
}

export async function collectStudentDossier(courseId: string, studentId: string, opts?: { extractPdfText?: boolean; maxTotalBytes?: number; include?: DossierInclude }): Promise<DossierResult> {
  const doExtract = opts?.extractPdfText ?? false;
  // 포함 항목 선택(정리 PDF 전용). 없으면 전부.
  const inc = opts?.include;
  const secOn = (k: string) => !inc?.sections || inc.sections.includes(k);
  const colOn = (c: number) => !inc?.assignmentColumns || inc.assignmentColumns.includes(c);
  const assignmentsOn = !inc?.assignmentColumns || inc.assignmentColumns.length > 0;
  // AI 입력(text)의 전체 상한. 기본 64KB. 평가 보고서는 지연(TTFT) 단축을 위해 더 작게 넘긴다.
  // 참고: sections(원문 렌더용)는 이 상한과 무관하게 항상 전량 유지된다.
  const totalCap = Math.max(8 * 1024, opts?.maxTotalBytes ?? CAP_TOTAL);

  const [user, rep, books, msgs, examRows, assignmentsAll, standards, posts, postComments, peerGot] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: { studentProfile: { select: { realName: true } } } }),
    prisma.mentoringReport.findUnique({ where: { courseId_studentId: { courseId, studentId } } }),
    prisma.mentoringBook.findMany({ where: { courseId, studentId }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringMessage.findMany({ where: { courseId, studentId, deletedAt: null }, orderBy: { createdAt: "asc" }, take: -MAX_CHAT_MSGS }),
    secOn("exam")
      ? loadExamRows(courseId, studentId).catch((e) => { console.error("[dossier] 시험 결과 조회 실패 — 섹션을 비움", courseId, studentId, e); return [] as ExamRow[]; })
      : Promise.resolve([] as ExamRow[]),
    prisma.mentoringAssignment.findMany({ where: { courseId, studentId }, orderBy: [{ column: "asc" }, { createdAt: "asc" }] }),
    prisma.mentoringAchievementStandard.findMany({ where: { courseId }, orderBy: { sort: "asc" }, select: { area: true, code: true, content: true } }),
    prisma.coursePost.findMany({ where: { courseId, authorId: studentId, kind: "DISCUSSION" }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, body: true, kind: true, createdAt: true } }),
    prisma.coursePostComment.findMany({
      where: { authorId: studentId, post: { courseId } },
      orderBy: { createdAt: "asc" },
      select: {
        body: true,
        createdAt: true,
        parentCommentId: true,
        fileName: true,
        post: { select: { id: true, title: true, kind: true, createdAt: true } },
        parent: { select: { authorId: true, author: { select: { studentProfile: { select: { realName: true } } } } } },
      },
    }),
    prisma.mentoringPeerReview.findMany({ where: { courseId, recipientStudentId: studentId }, orderBy: [{ column: "asc" }, { createdAt: "asc" }], select: { column: true, assignmentName: true, authorStudentId: true, status: true } }),
  ]);

  const assignments = assignmentsAll.filter((a) => colOn(a.column));
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
  if (!secOn("report")) {
    /* 선택 제외 */
  } else if (rep) {
    const lines: string[] = [];
    for (const [k, label] of REPORT_LABELS) {
      const v = (rep[k] as string) || "";
      if (v.trim()) lines.push(`- ${label}: ${v.trim()}`);
    }
    const stds = parseStandards(rep.standard || "");
    if (stds.length) lines.push(`- 선택한 성취기준: ${stds.map((s) => `${s.code ? `[${s.code}] ` : ""}${s.content}`).join(" / ")}`);
    if (hasReportPdf) lines.push(`- 첨부 보고서 파일: ${rep.fileName}`);
    sections.push({ key: "report", title: "탐구 보고서", body: fullBody(lines.join("\n")) });
  } else {
    sections.push({ key: "report", title: "탐구 보고서", body: "(없음)" });
  }
  // 1-1) 보고서 첨부 원문(추출)
  if (doExtract && reportFileText && secOn("report_file")) sections.push({ key: "report_file", title: "탐구 보고서 첨부 원문(추출)", body: fullBody(reportFileText) });

  // 2) 독서활동
  if (secOn("books")) sections.push({ key: "books", title: "독서활동", body: fullBody(books.map((b, i) => {
    const bits = [b.book && `『${b.book}』`, b.author && `(${b.author})`].filter(Boolean).join(" ");
    const detail = [b.motive && `동기: ${b.motive}`, b.review && `감상: ${b.review}`, b.influence && `영향: ${b.influence}`].filter(Boolean).join(" / ");
    return `${i + 1}. ${bits}${detail ? ` — ${detail}` : ""}`;
  }).join("\n")) });

  // 3) 1:1 멘토링 채팅
  if (secOn("chat")) sections.push({ key: "chat", title: "1:1 멘토링 대화", body: fullBody(msgs.filter((m) => m.text.trim()).map((m) => `[${m.senderRole === "teacher" ? "교사" : "학생"}] ${m.text.trim()}`).join("\n")) });

  // 5) 제출 과제(이름/슬롯) — 선택한 슬롯만
  if (assignmentsOn) sections.push({ key: "assignment", title: "제출 과제", body: fullBody(assignments.map((a) => `- 과제${a.column + 1}: ${a.name}`).join("\n")) });
  // 5-1) 과제 원문(추출)
  if (doExtract && assignmentText && assignmentsOn) sections.push({ key: "assignment_file", title: "제출 과제 원문(추출)", body: fullBody(assignmentText) });

  // 6) 강좌 토론 게시판 — 글(게시물)별로 묶어 학생의 글·댓글·답글을 날짜와 함께 전량 수록.
  //    상호 피드백 과제(@이름 댓글)도 해당 안내 글 아래에 그대로 보이도록 한다.
  type BoardGroup = { title: string; kind: string; at: Date; ownBody: string | null; lines: string[] };
  const groups = new Map<string, BoardGroup>();
  for (const p of posts) groups.set(p.id, { title: p.title, kind: p.kind, at: p.createdAt, ownBody: p.body?.trim() ?? "", lines: [] });
  for (const c of postComments) {
    let g = groups.get(c.post.id);
    if (!g) {
      g = { title: c.post.title, kind: c.post.kind, at: c.post.createdAt, ownBody: null, lines: [] };
      groups.set(c.post.id, g);
    }
    const body = c.body.trim();
    if (!body && !c.fileName) continue;
    const replyTo = c.parentCommentId ? (c.parent?.authorId === studentId ? "내 댓글" : c.parent?.author?.studentProfile?.realName ?? "댓글") : null;
    const tag = `(${fmtDay(c.createdAt)}${replyTo ? ` · 답글 → ${replyTo}` : ""})`;
    const attach = c.fileName ? `[첨부: ${c.fileName}]` : "";
    g.lines.push(`- ${tag} ${[body, attach].filter(Boolean).join("\n")}`);
  }
  const boardParts: string[] = [];
  if (peerGot.length) {
    const authorIds = [...new Set(peerGot.map((r) => r.authorStudentId).filter(Boolean))];
    const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, studentProfile: { select: { realName: true } } } }) : [];
    const nameOf = new Map(authors.map((u) => [u.id, u.studentProfile?.realName ?? "학생"]));
    const byCol = new Map<number, string[]>();
    for (const r of peerGot) {
      const st = r.status === "deleted" ? " (삭제됨)" : r.status === "resubmitted" ? " (재제출본)" : "";
      byCol.set(r.column, [...(byCol.get(r.column) ?? []), `${nameOf.get(r.authorStudentId) ?? "학생"} 「${r.assignmentName || "과제"}」${st}`]);
    }
    const summary = [...byCol.entries()].sort((a, b) => a[0] - b[0]).map(([col, items]) => `과제${col + 1} — ${items.join(", ")}`).join(" / ");
    boardParts.push(`※ 상호 피드백 배정(받아서 피드백할 다른 학생 과제): ${summary}\n  → 작성한 피드백은 아래 '상호 피드백 과제 안내' 글의 댓글(@이름)에 수록.`);
  }
  for (const g of [...groups.values()].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const head = g.ownBody !== null
      ? `■ [내 글] ${g.title} (${fmtDay(g.at)})`
      : `■ ${g.kind === "NOTICE" ? "[공지] " : ""}${g.title} — 내 댓글 ${g.lines.length}건`;
    boardParts.push([head, g.ownBody || null, ...g.lines].filter((x): x is string => !!x).join("\n"));
  }
  if (secOn("board")) sections.push({ key: "board", title: "강좌 토론 게시판 활동", body: fullBody(boardParts.join("\n\n")) });

  // 7) 시험 결과(강의실 '시험' 탭) — 배정된 시험의 응시 상태·자동채점 점수·오답 문항 번호(정답은 미기재)
  if (secOn("exam")) sections.push({ key: "exam", title: "시험 결과", body: fullBody(formatExamSection(examRows)) });

  // 8) 강좌 성취기준(맥락)
  if (secOn("standards")) sections.push({ key: "standards", title: "강좌 성취기준(참고)", body: fullBody(standards.map((s) => `- ${s.area ? `[${s.area}] ` : ""}${s.code ? `${s.code} ` : ""}${s.content}`).join("\n")) });

  const header = `# ${studentName} 학생 활동 종합 (강좌 ${courseId})\n아래는 학생이 우아재에서 남긴 활동의 취합본이다(업로드 문서 원문 포함). 여기에 없는 사실은 지어내지 않는다.\n`;
  let text = `${header}\n${sections.map((s) => `## ${s.title}\n${aiBody(s.key, s.body)}`).join("\n\n")}`;
  if (byteLen(text) > totalCap) text = `${truncateToBytes(text, totalCap)}\n…(전체 분량 초과로 일부 생략 — 활동 정리 PDF에는 전량 수록)`;

  return { text, byteCount: byteLen(text), hasReportPdf, studentName, sections };
}
