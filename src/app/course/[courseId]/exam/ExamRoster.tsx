"use client";

import { useCallback, useEffect, useState } from "react";
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
type Cell = { status: string; score?: number; total?: number };
type Roster = { exams: ExamCol[]; students: Student[]; cells: Record<string, Record<string, Cell>> };

function CellView({ cell, onClick }: { cell: Cell | undefined; onClick?: () => void }) {
  if (!cell || cell.status === "unassigned") return <span className="text-[13px]" style={{ color: "#C9C2B4" }}>–</span>;
  if (cell.status === "not_started") return <span className="text-[12.5px]" style={{ color: SUB }}>미응시</span>;
  if (cell.status === "in_progress") return <span className="text-[12.5px] font-semibold" style={{ color: "#B06B2E" }}>응시중</span>;
  if (cell.status === "zero") {
    // 마감 후 미응시 → 0점(응시 기록 없어 리뷰 불가)
    return (
      <span title="미응시 · 마감(0점)">
        <span className="text-[15px] font-extrabold" style={{ color: "#B4544B" }}>0</span>
        <span className="text-[11.5px] font-semibold" style={{ color: SUB }}>/{cell.total ?? 100}</span>
      </span>
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

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/exam/roster`, { cache: "no-store" });
      const d = (await res.json()) as Roster & { error?: string };
      if (!res.ok) { setError(d.error ?? "명렬표를 불러오지 못했습니다."); return; }
      setError(null);
      setData(d);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

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
                      <th key={e.id} className="border-b border-l px-3 py-2.5 text-center text-[12.5px] font-bold" style={{ borderColor: LINE, color: INK, minWidth: 104 }}>
                        <div className="flex items-center justify-center gap-1">
                          <span className="truncate" title={e.title}>{e.title}</span>
                          <button type="button" onClick={() => router.push(`/course/${courseId}/exam/${e.id}/edit`)} title="시험 수정" className="shrink-0 rounded p-0.5 transition hover:bg-[#F1EADD]" style={{ color: BROWN }}><Pencil size={12} /></button>
                          <button type="button" onClick={() => void deleteExam(e.id, e.title)} title="시험 삭제" className="shrink-0 rounded p-0.5 transition hover:bg-[#F2ECEC]" style={{ color: "#B4544B" }}><Trash2 size={13} /></button>
                        </div>
                        <div className="text-[11px] font-medium" style={{ color: SUB }}>제출 {e.submittedCount}/{e.assignedCount} · {e.total}점</div>
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
                          <CellView cell={data.cells[s.id]?.[e.id]} onClick={() => router.push(`/course/${courseId}/exam/${e.id}/result?studentId=${s.id}`)} />
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
          <p className="mt-3 text-[12.5px]" style={{ color: SUB }}>점수를 누르면 해당 학생의 답안을 채점 결과(맞/틀)와 함께 볼 수 있습니다. 주관식은 자동채점이 표기와 다를 수 있어 확인이 필요합니다.</p>
        </div>
      </main>
    </div>
  );
}
