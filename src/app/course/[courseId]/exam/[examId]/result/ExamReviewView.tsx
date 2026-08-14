"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Download, LogOut, FileText } from "lucide-react";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const OK = "#3E7E5B";
const NO = "#C0392B";
const serif = { fontFamily: "var(--font-serif)" } as const;

type QRes = { number: number; type: string; points: number; correct: boolean; studentChoice: number | null; studentText: string | null; answerKey: string };
type Result = { score: number; total: number; correctCount: number; per: QRes[] };
type Data = {
  exam: { title: string; subject: string; durationSec: number; hasStudentPaper: boolean; studentPageCount: number };
  attempt: { status: string; submittedAt: string | null };
  studentName?: string;
  result: Result | null;
  noShow?: boolean;
};

export default function ExamReviewView({ courseId, examId, isStaff, studentId }: { courseId: string; examId: string; isStaff: boolean; studentId: string }) {
  const router = useRouter();
  const base = `/api/courses/${courseId}/exam/${examId}`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q = isStaff && studentId ? `?studentId=${studentId}` : "";
        const res = await fetch(`${base}/result${q}`, { cache: "no-store" });
        const d = (await res.json()) as Data & { error?: string };
        if (!alive) return;
        if (!res.ok) { setError(d.error ?? "결과를 불러오지 못했습니다."); return; }
        setData(d);
      } catch {
        if (alive) setError("네트워크 오류가 발생했습니다.");
      }
    })();
    return () => { alive = false; };
  }, [base, isStaff, studentId]);

  function download(part: "questions" | "explanation") {
    window.open(`${base}/paper?part=${part}&download=1`, "_blank", "noopener");
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[560px] px-6 py-32 text-center">
        <p className="text-[16px]" style={{ color: BODY }}>{error}</p>
        <button onClick={() => router.push(`/course/${courseId}/exam`)} className="mt-6 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: BROWN }}>시험으로</button>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-[640px] px-6 py-40 text-center" style={{ color: SUB }}>불러오는 중…</div>;

  const r = data.result;
  const pct = r && r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;

  return (
    <div style={{ background: "#fff", color: BODY }}>
      {/* 상단 바 */}
      <div className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur" style={{ borderColor: LINE }}>
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-semibold" style={{ ...serif, color: INK }}>{data.exam.title}{isStaff && data.studentName ? ` · ${data.studentName}` : ""}</h1>
          </div>
          <div className="flex items-baseline gap-1 rounded-[10px] px-3 py-1" style={{ background: "#F1EADD" }}>
            <span className="text-[20px] font-extrabold" style={{ color: DEEP }}>{r?.score ?? 0}</span>
            <span className="text-[13px] font-semibold" style={{ color: SUB }}>/ {r?.total ?? 100}점</span>
            <span className="ml-1 text-[12px] font-semibold" style={{ color: pct >= 60 ? OK : NO }}>({pct}%)</span>
          </div>
          <button type="button" onClick={() => setPdfOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-semibold lg:hidden" style={{ borderColor: LINE, color: BODY }}><FileText size={14} /> 시험지</button>
          <button type="button" onClick={() => download("explanation")} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: LINE, color: BODY }}><Download size={14} /> 해설지</button>
          <button type="button" onClick={() => router.push(`/course/${courseId}/exam`)} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: LINE, color: SUB }}><LogOut size={14} /> 나가기</button>
        </div>
      </div>

      {/* 좌 시험지 + 우 채점 */}
      <div className="lg:flex lg:items-start">
        <div className={`${pdfOpen ? "block" : "hidden"} border-b lg:sticky lg:top-[53px] lg:block lg:w-[48%] lg:shrink-0 lg:self-start lg:border-b-0 lg:border-r`} style={{ borderColor: LINE }}>
          <iframe src={`${base}/paper?part=questions#toolbar=1&navpanes=0&view=FitH`} title="시험지" className="h-[62vh] w-full lg:h-[calc(100vh-53px)]" style={{ background: PANEL }} />
        </div>

        <main className="min-w-0 flex-1 px-5 pb-32 pt-6 lg:px-8">
          <div className="mx-auto max-w-[680px]">
            {data.noShow ? (
              <p className="mb-4 rounded-[10px] px-4 py-3 text-[13.5px] leading-6" style={{ background: "#F7ECEC", color: "#B4544B" }}>
                응시 마감까지 응시하지 않아 <b>0점 처리</b>된 시험입니다. 아래는 문제별 정답이며, 왼쪽 시험지와 해설지로 복습할 수 있어요.
              </p>
            ) : (
              <p className="mb-4 text-[13.5px]" style={{ color: SUB }}>
                {r ? <>정답 <b style={{ color: OK }}>{r.correctCount}</b> / {r.per.length}문항 · 자동채점 결과입니다.</> : "채점 데이터가 없습니다."}
                {" "}주관식은 표기 차이로 오채점될 수 있어요.
              </p>
            )}

            <div className="divide-y" style={{ borderColor: "#F0EBE0" }}>
              {(r?.per ?? []).map((q) => (
                <div key={q.number} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: q.correct ? "#E9F3EC" : "#F7ECEC" }}>
                    {q.correct ? <Check size={14} color={OK} /> : <X size={14} color={NO} />}
                  </span>
                  <span className="w-6 shrink-0 text-[15px] font-bold" style={{ color: INK }}>{q.number}</span>
                  <div className="min-w-0 flex-1 text-[14px] leading-6">
                    <span style={{ color: SUB }}>내 답 </span>
                    <b style={{ color: q.correct ? OK : NO }}>{q.type === "mcq" ? (q.studentChoice ?? "무응답") : (q.studentText?.trim() || "무응답")}</b>
                    {!q.correct ? (
                      <>
                        <span style={{ color: SUB }}> · 정답 </span>
                        <b style={{ color: INK }}>{q.answerKey || "-"}</b>
                      </>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold" style={{ color: q.correct ? OK : "#C9C2B4" }}>{q.correct ? `+${q.points}` : "0"}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
