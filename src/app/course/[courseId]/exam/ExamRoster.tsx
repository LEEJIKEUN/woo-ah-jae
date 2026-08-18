"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Pencil } from "lucide-react";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type ExamCol = { id: string; title: string; subject: string; status: string; total: number; assignedCount: number; submittedCount: number; opensAt: string | null; closesAt: string | null };

/** ISO → "8/14 22:01" (한국시간) */
function fmtKst(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
type Student = { id: string; name: string };
type Cell = { status: string; score?: number; total?: number; correct?: number; answered?: number; unanswered?: number; qCount?: number; deadlineAt?: string };
type Roster = { exams: ExamCol[]; students: Student[]; cells: Record<string, Record<string, Cell>>; serverNow?: string };

/** 남은시간 mm:ss (1시간 이상이면 h:mm:ss) */
function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

function CellView({ cell, onClick, nowMs }: { cell: Cell | undefined; onClick?: () => void; nowMs: number }) {
  if (!cell) return <span className="text-[13px]" style={{ color: "#C9C2B4" }}>–</span>;
  // 아직 응시 안 한 학생(미배정 포함) → '미응시'
  if (cell.status === "unassigned" || cell.status === "not_started") return <span className="text-[12.5px]" style={{ color: SUB }}>미응시</span>;
  if (cell.status === "in_progress") {
    // 실시간 진행: 응시중 · 맞춘 수 · 체크한 수/총문항 · 남은시간 (한 줄)
    const q = cell.qCount ?? 0;
    const answered = cell.answered ?? 0;
    const remainMs = cell.deadlineAt ? Date.parse(cell.deadlineAt) - nowMs : null;
    const over = remainMs != null && remainMs <= 0;
    const danger = remainMs != null && remainMs > 0 && remainMs <= 60_000;
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-[11.5px]">
        <span className="inline-flex items-center gap-1 font-bold" style={{ color: "#B06B2E" }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#B06B2E" }} />응시중
        </span>
        <span className="font-bold tabular-nums" style={{ color: "#3E7E5B" }}>정답 {cell.correct ?? 0}</span>
        <span className="tabular-nums" style={{ color: DEEP }}>체크 {answered}/{q}</span>
        {remainMs != null ? (
          <span className={`tabular-nums font-bold ${danger ? "animate-pulse" : ""}`} style={{ color: over ? "#B4544B" : danger ? "#C0392B" : "#8A8479" }}>
            {over ? "시간 종료" : fmtRemain(remainMs)}
          </span>
        ) : null}
      </span>
    );
  }
  if (cell.status === "zero") {
    // 마감 후 미응시 → 0점. 클릭하면 문제·정답 리뷰(빈 답안)
    return (
      <button type="button" onClick={onClick} className="rounded-[8px] px-2.5 py-1 transition hover:bg-[#F7ECEC]" title="미응시 · 마감(0점) — 문제·정답 보기">
        <span className="text-[15px] font-extrabold" style={{ color: "#B4544B" }}>0</span>
        <span className="text-[11.5px] font-semibold" style={{ color: SUB }}>/{cell.total ?? 100}</span>
      </button>
    );
  }
  // 종료됨(제출/시간종료) → 점수(클릭 리뷰)
  return (
    <button type="button" onClick={onClick} className="rounded-[8px] px-2.5 py-1 transition hover:bg-[#F1EADD]" title="답안 채점 리뷰">
      <span className="text-[15px] font-extrabold" style={{ color: DEEP }}>{cell.score ?? 0}</span>
      <span className="text-[11.5px] font-semibold" style={{ color: SUB }}>/{cell.total ?? 100}</span>
    </button>
  );
}

export default function ExamRoster({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0); // 서버시각 − 클라시각(잔여시간 보정)
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/exam/roster`, { cache: "no-store" });
      const d = (await res.json()) as Roster & { error?: string };
      if (!res.ok) { setError(d.error ?? "명렬표를 불러오지 못했습니다."); return; }
      offsetRef.current = d.serverNow ? Date.parse(d.serverNow) - Date.now() : 0;
      setError(null);
      setData(d);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  // 잔여시간 표시용 1초 틱(관리자 브라우저 로컬 — 서버 트래픽 없음)
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 실시간 응시 현황(SSE) — 학생이 마킹/제출/응시시작하면 해당 셀 즉시 갱신
  useEffect(() => {
    const es = new EventSource(`/api/courses/${courseId}/exam/roster/stream`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type?: string; examId?: string; studentId?: string; cell?: Cell };
        if (msg.type !== "cell" || !msg.examId || !msg.studentId || !msg.cell) return;
        setData((prev) => {
          if (!prev || !prev.cells[msg.studentId!]) return prev; // 현재 표에 있는 학생만 반영
          return {
            ...prev,
            cells: { ...prev.cells, [msg.studentId!]: { ...prev.cells[msg.studentId!], [msg.examId!]: msg.cell! } },
          };
        });
      } catch {
        /* 무시 */
      }
    };
    es.onerror = () => { /* 브라우저가 자동 재연결 */ };
    return () => es.close();
  }, [courseId]);

  // 제출 수 실시간 집계(셀 상태 기준) — 헤더 "제출 X/Y" 를 새로고침 없이 갱신
  const liveSubmitted = useCallback(
    (examId: string) => (data ? data.students.filter((s) => { const st = data.cells[s.id]?.[examId]?.status; return st === "submitted" || st === "expired"; }).length : 0),
    [data]
  );

  async function deleteExam(examId: string, title: string) {
    if (!confirm(`'${title}' 시험을 삭제할까요?\n학생 응시·채점 기록과 업로드한 PDF까지 모두 삭제되며 되돌릴 수 없습니다.`)) return;
    try {
      const res = await fetch(`/api/courses/${courseId}/exam/${examId}`, { method: "DELETE" });
      if (res.ok) { void load(); }
      else { const d = (await res.json().catch(() => ({}))) as { error?: string }; alert(d.error ?? "삭제에 실패했습니다."); }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  }

  // ── 평균 계산(소수점 2자리 절사) ──
  const fmtAvg = (x: number) => (Math.floor(x * 100) / 100).toFixed(2);
  const avgOf = (scores: number[]): { avg: number; count: number } | null => (scores.length ? { avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length } : null);
  const examScores = (examId: string): number[] => (data ? data.students.map((s) => data.cells[s.id]?.[examId]).filter((c): c is Cell => !!c && typeof c.score === "number").map((c) => c.score as number) : []);
  const studentScores = (studentId: string): number[] => (data ? data.exams.map((e) => data.cells[studentId]?.[e.id]).filter((c): c is Cell => !!c && typeof c.score === "number").map((c) => c.score as number) : []);
  const allScores = (): number[] => (data ? data.students.flatMap((s) => studentScores(s.id)) : []);
  function renderAvg(scores: number[], showCount: boolean, color: string = DEEP) {
    const a = avgOf(scores);
    if (!a) return <span className="text-[12.5px]" style={{ color: "#C9C2B4" }}>–</span>;
    return (
      <span title={`${a.count}개 평균`}>
        <span className="text-[15px] font-extrabold" style={{ color }}>{fmtAvg(a.avg)}</span>
        {showCount ? <span className="text-[10.5px] font-semibold" style={{ color: SUB }}> ({a.count}명)</span> : null}
      </span>
    );
  }

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff />
      <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-[1100px]">
          <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>← 강의실</Link>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[24px] font-normal md:text-[28px]" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>시험 · 응시 현황</h1>
            <Link href={`/course/${courseId}/exam/new`} className="rounded-full px-4 py-2 text-[13.5px] font-bold text-white" style={{ background: BROWN }}>＋ 시험 만들기</Link>
          </div>

          {error ? (
            <p className="py-16 text-center text-[14px]" style={{ color: "#a6402c" }}>{error}</p>
          ) : !data ? (
            <p className="py-16 text-center text-[14px]" style={{ color: SUB }}>불러오는 중…</p>
          ) : data.exams.length === 0 ? (
            <div className="rounded-[14px] border py-16 text-center" style={{ borderColor: LINE, background: PANEL }}>
              <p className="text-[15px]" style={{ color: SUB }}>아직 만든 시험이 없습니다. ‘＋ 시험 만들기’로 시작하세요.</p>
            </div>
          ) : data.students.length === 0 ? (
            <div className="rounded-[14px] border py-16 text-center" style={{ borderColor: LINE, background: PANEL }}>
              <p className="text-[15px]" style={{ color: SUB }}>수강생이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[14px] border" style={{ borderColor: LINE }}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr style={{ background: PANEL }}>
                    <th className="sticky left-0 z-10 min-w-[120px] border-b px-4 py-3 text-[13px] font-bold" style={{ borderColor: LINE, color: INK, background: PANEL }}>수강생</th>
                    {data.exams.map((e) => (
                      <th key={e.id} className="border-b border-l px-3 py-2.5 text-center text-[12.5px] font-bold" style={{ borderColor: LINE, color: INK, minWidth: 128 }}>
                        <div className="flex items-center justify-center gap-1">
                          <span className="truncate" title={e.title}>{e.title}</span>
                          <button type="button" onClick={() => router.push(`/course/${courseId}/exam/${e.id}/edit`)} title="시험 수정" className="shrink-0 rounded p-0.5 transition hover:bg-[#F1EADD]" style={{ color: BROWN }}><Pencil size={12} /></button>
                          <button type="button" onClick={() => void deleteExam(e.id, e.title)} title="시험 삭제" className="shrink-0 rounded p-0.5 transition hover:bg-[#F2ECEC]" style={{ color: "#B4544B" }}><Trash2 size={13} /></button>
                        </div>
                        <div className="text-[11px] font-medium" style={{ color: SUB }}>제출 {liveSubmitted(e.id)}/{e.assignedCount} · {e.total}점</div>
                        {e.opensAt || e.closesAt ? <div className="text-[10.5px] font-medium" style={{ color: SUB }}>{fmtKst(e.opensAt) || "즉시"}~{fmtKst(e.closesAt) || "무제한"}</div> : null}
                      </th>
                    ))}
                    <th className="border-b border-l px-3 py-2.5 text-center text-[12.5px] font-bold" style={{ borderColor: LINE, color: INK, minWidth: 84, background: "#F3EDE0" }}>
                      평균<div className="text-[10.5px] font-medium" style={{ color: SUB }}>누적</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-10 border-b px-4 py-2.5 text-[13.5px] font-semibold" style={{ borderColor: "#F0EBE0", color: INK, background: "#fff" }}>{s.name}</td>
                      {data.exams.map((e) => (
                        <td key={e.id} className="border-b border-l px-3 py-2.5 text-center" style={{ borderColor: "#F0EBE0" }}>
                          <CellView cell={data.cells[s.id]?.[e.id]} nowMs={nowMs + offsetRef.current} onClick={() => router.push(`/course/${courseId}/exam/${e.id}/result?studentId=${s.id}`)} />
                        </td>
                      ))}
                      <td className="border-b border-l px-3 py-2.5 text-center" style={{ borderColor: "#F0EBE0", background: "#FBF8F2" }}>
                        {renderAvg(studentScores(s.id), false)}
                      </td>
                    </tr>
                  ))}
                  {/* 평균 행 */}
                  <tr style={{ background: "#F3EDE0" }}>
                    <td className="sticky left-0 z-10 border-t px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: LINE, color: INK, background: "#F3EDE0" }}>평균</td>
                    {data.exams.map((e) => (
                      <td key={e.id} className="border-t border-l px-3 py-2.5 text-center" style={{ borderColor: LINE }}>{renderAvg(examScores(e.id), true)}</td>
                    ))}
                    <td className="border-t border-l px-3 py-2.5 text-center" style={{ borderColor: LINE }}>{renderAvg(allScores(), false, BROWN)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[12.5px]" style={{ color: SUB }}>응시 중인 학생은 <b style={{ color: "#B06B2E" }}>정답·체크 수</b>가 실시간으로 갱신됩니다(마킹 즉시 반영). 점수를 누르면 채점 결과(맞/틀)를 볼 수 있고, 주관식 자동채점은 표기와 다를 수 있어 확인이 필요합니다.</p>
        </div>
      </main>
    </div>
  );
}
