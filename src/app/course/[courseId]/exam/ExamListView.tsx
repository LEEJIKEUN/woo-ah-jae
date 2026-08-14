"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, PenLine, Download } from "lucide-react";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Attempt = { status: string | null; deadlineAt: string; submittedAt: string | null; score: number | null; total: number | null };
type Row = {
  id: string;
  title: string;
  subject: string;
  status: string; // draft | published | closed
  durationSec: number;
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  total?: number;
  assignedCount?: number;
  submittedCount?: number;
  attempt: Attempt | null;
};

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

/** ISO → "8/14 22:01" (한국시간) */
function fmtKst(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

type Badge = { label: string; bg: string; fg: string };

function studentBadge(row: Row, nowMs: number): Badge {
  const at = row.attempt;
  if (at) {
    if (at.status === "submitted") return { label: "제출 완료", bg: "#E9F3EC", fg: "#3E7E5B" };
    if (at.status === "expired") return { label: "시간 종료", bg: "#F2ECEC", fg: "#a6402c" };
    const remain = Date.parse(at.deadlineAt) - nowMs;
    if (remain <= 0) return { label: "시간 종료", bg: "#F2ECEC", fg: "#a6402c" };
    return { label: `응시 중 · ${fmt(remain)} 남음`, bg: "#FBEEE0", fg: "#B06B2E" };
  }
  if (row.status === "closed" || (row.closesAt && nowMs > Date.parse(row.closesAt))) return { label: "마감", bg: "#EFEDE8", fg: SUB };
  if (row.opensAt && nowMs < Date.parse(row.opensAt)) return { label: "오픈 예정", bg: "#EFEDE8", fg: SUB };
  return { label: "응시 전", bg: "#F1EADD", fg: BROWN };
}

export default function ExamListView({ courseId, isStaff }: { courseId: string; isStaff: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0); // serverNow - clientNow
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/exam`, { cache: "no-store" });
        const d = (await res.json()) as { serverNow?: string; rows?: Row[]; error?: string };
        if (!alive) return;
        if (!res.ok) { setError(d.error ?? "시험 목록을 불러오지 못했습니다."); return; }
        if (d.serverNow) offsetRef.current = Date.parse(d.serverNow) - Date.now();
        setRows(d.rows ?? []);
      } catch {
        if (alive) setError("네트워크 오류가 발생했습니다.");
      }
    })();
    return () => { alive = false; };
  }, [courseId]);

  // 1초마다 '남은 시간' 갱신(서버 오프셋 반영)
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now() + offsetRef.current), 1000);
    return () => clearInterval(t);
  }, []);

  const openPaper = useCallback((id: string) => {
    window.open(`/api/courses/${courseId}/exam/${id}/paper`, "_blank", "noopener");
  }, [courseId]);

  const goAnswer = useCallback((id: string) => {
    router.push(`/course/${courseId}/exam/${id}/answer`);
  }, [courseId, router]);

  const goResult = useCallback((id: string) => {
    router.push(`/course/${courseId}/exam/${id}/result`);
  }, [courseId, router]);

  const download = useCallback((id: string, part: "questions" | "explanation") => {
    window.open(`/api/courses/${courseId}/exam/${id}/paper?part=${part}&download=1`, "_blank", "noopener");
  }, [courseId]);

  const body = useMemo(() => {
    if (error) return <p className="py-16 text-center text-[14px]" style={{ color: "#a6402c" }}>{error}</p>;
    if (rows === null) return <p className="py-16 text-center text-[14px]" style={{ color: SUB }}>불러오는 중…</p>;
    if (rows.length === 0) {
      return (
        <div className="rounded-[14px] border py-16 text-center" style={{ borderColor: LINE, background: PANEL }}>
          <p className="text-[15px]" style={{ color: SUB }}>{isStaff ? "아직 만든 시험이 없습니다." : "배정된 시험이 없습니다."}</p>
        </div>
      );
    }
    return (
      <ul className="space-y-3">
        {rows.map((row) => {
          const badge = isStaff ? null : studentBadge(row, nowMs);
          const notOpenYet = !!row.opensAt && nowMs < Date.parse(row.opensAt);
          const closedByTime = !!row.closesAt && nowMs > Date.parse(row.closesAt);
          const answerDisabled = !isStaff && !row.attempt && (row.status === "closed" || notOpenYet || closedByTime);
          const termDone = !isStaff && !!row.attempt && (row.attempt.status === "submitted" || row.attempt.status === "expired");
          const noShowZero = !isStaff && !row.attempt && (row.status === "closed" || closedByTime); // 마감 후 미응시 → 0점
          return (
            <li key={row.id} className="rounded-[14px] border p-5" style={{ borderColor: LINE, background: "#fff" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-semibold" style={{ ...serif, color: INK }}>{row.title}</h3>
                    {badge ? (
                      <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                    ) : (
                      <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: PANEL, color: SUB }}>
                        {row.status === "published" ? "발송됨" : row.status === "closed" ? "마감" : "임시저장"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px]" style={{ color: SUB }}>
                    {row.subject ? `${row.subject} · ` : ""}
                    {row.questionCount}문항 · 제한시간 {Math.round(row.durationSec / 60)}분
                    {isStaff ? ` · 배정 ${row.assignedCount ?? 0}명 · 제출 ${row.submittedCount ?? 0}명` : ""}
                  </p>
                  {row.opensAt || row.closesAt ? (
                    <p className="mt-0.5 text-[12px]" style={{ color: closedByTime || notOpenYet ? "#B06B2E" : SUB }}>
                      응시 기간: {fmtKst(row.opensAt) || "즉시"} ~ {fmtKst(row.closesAt) || "무제한"} <span style={{ color: SUB }}>(한국시간)</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {isStaff ? (
                    <button
                      type="button"
                      onClick={() => openPaper(row.id)}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border px-3.5 py-2 text-[13.5px] font-semibold transition hover:bg-[#FBF6EC]"
                      style={{ borderColor: LINE, color: BODY }}
                    >
                      <FileText size={15} /> 시험지
                    </button>
                  ) : termDone ? (
                    <>
                      <button type="button" onClick={() => goResult(row.id)} className="rounded-[10px] px-4 py-2 text-left transition hover:opacity-90" style={{ background: "#F1EADD" }} title="채점 결과·해설 보기">
                        <span className="text-[18px] font-extrabold" style={{ color: DEEP }}>{row.attempt?.score ?? 0}</span>
                        <span className="text-[13px] font-semibold" style={{ color: SUB }}> / {row.attempt?.total ?? 100}점</span>
                      </button>
                      <button type="button" onClick={() => download(row.id, "questions")} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12.5px] font-semibold transition hover:bg-[#FBF6EC]" style={{ borderColor: LINE, color: BODY }}><Download size={14} /> 문제지</button>
                      <button type="button" onClick={() => download(row.id, "explanation")} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12.5px] font-semibold transition hover:bg-[#FBF6EC]" style={{ borderColor: LINE, color: BODY }}><Download size={14} /> 해설지</button>
                    </>
                  ) : noShowZero ? (
                    <>
                      <button type="button" onClick={() => goResult(row.id)} className="rounded-[10px] px-4 py-2 transition hover:opacity-90" style={{ background: "#F7ECEC" }} title="미응시(0점) · 문제·정답 보기">
                        <span className="text-[18px] font-extrabold" style={{ color: "#B4544B" }}>0</span>
                        <span className="text-[13px] font-semibold" style={{ color: SUB }}> / {row.total ?? 100}점 · 미응시</span>
                      </button>
                      <button type="button" onClick={() => download(row.id, "questions")} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12.5px] font-semibold transition hover:bg-[#FBF6EC]" style={{ borderColor: LINE, color: BODY }}><Download size={14} /> 문제지</button>
                      <button type="button" onClick={() => download(row.id, "explanation")} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12.5px] font-semibold transition hover:bg-[#FBF6EC]" style={{ borderColor: LINE, color: BODY }}><Download size={14} /> 해설지</button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goAnswer(row.id)}
                      disabled={answerDisabled}
                      className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: BROWN }}
                    >
                      <PenLine size={15} /> 응시하기
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }, [rows, error, isStaff, nowMs, openPaper, goAnswer]);

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff={isStaff} />
      <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-[880px]">
          <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>← 강의실</Link>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[24px] font-normal md:text-[28px]" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>시험</h1>
            {isStaff ? (
              <Link href={`/course/${courseId}/exam/new`} className="rounded-full px-4 py-2 text-[13.5px] font-bold text-white" style={{ background: BROWN }}>＋ 시험 만들기</Link>
            ) : null}
          </div>
          {body}
          {!isStaff ? (
            <p className="mt-6 rounded-[10px] px-4 py-3 text-[12.5px] leading-6" style={{ background: PANEL, color: SUB }}>
              ※ 시험은 <b style={{ color: BROWN }}>응시 기간(시작~마감, 한국시간)</b> 안에 응시해야 합니다. 마감 시각이 지나면 <b style={{ color: "#B4544B" }}>응시하지 않은 시험은 자동으로 0점</b> 처리됩니다. 이미 응시를 시작했다면 개인 제한시간까지는 이어서 풀 수 있고, 마감 후에도 문제지·해설지는 내려받아 확인할 수 있어요.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
