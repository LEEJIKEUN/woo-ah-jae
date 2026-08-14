"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LogOut, Send, AlertTriangle } from "lucide-react";
import OmrRow from "./OmrRow";
import { useExamTimer } from "./useExamTimer";
import { useAutosave, readLocalBackup, clearLocalBackup, type AnswerMap, type LocalBackup } from "./useAutosave";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Question = { number: number; type: string; choiceCount: number; points: number };
type Exam = { id: string; title: string; subject: string; durationSec: number; status: string; opensAt: string | null; closesAt: string | null };
type Attempt = { id: string; startedAt: string; deadlineAt: string; submittedAt: string | null; lastSavedAt: string | null; status: string };

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
function relTime(ms: number | null): string {
  if (!ms) return "";
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 10_000) return "방금 전";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}초 전`;
  return `${Math.floor(diff / 60_000)}분 전`;
}

export default function ExamAnswerView({ courseId, examId, isStudent }: { courseId: string; examId: string; isStudent: boolean }) {
  const router = useRouter();
  const base = `/api/courses/${courseId}/exam/${examId}`;

  const [phase, setPhase] = useState<"loading" | "blocked" | "ready">("loading");
  const [blockMsg, setBlockMsg] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [serverNow, setServerNow] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const answersRef = useRef<AnswerMap>({});
  const [recovery, setRecovery] = useState<{ nos: number[]; local: LocalBackup } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false); // 모바일에서 시험지 패널 토글(데스크톱은 항상 표시)

  const readOnly = !attempt || attempt.status !== "in_progress";

  // ── 응시 시작(또는 기존 세션) ──
  useEffect(() => {
    if (!isStudent) { setBlockMsg("학생 계정만 응시할 수 있습니다."); setPhase("blocked"); return; }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${base}/attempt/start`, { method: "POST" });
        const d = (await res.json().catch(() => ({}))) as {
          serverNow?: string; exam?: Exam; attempt?: Attempt;
          questions?: Question[]; answers?: { questionNo: number; choice: number | null; textAnswer: string | null; updatedAt: string }[];
          code?: string; opensAt?: string; error?: string;
        };
        if (!alive) return;
        if (!res.ok || !d.attempt || !d.exam) {
          if (d.code === "NOT_OPEN" && d.opensAt) setBlockMsg(`아직 응시할 수 없습니다. (오픈: ${new Date(d.opensAt).toLocaleString("ko-KR")})`);
          else if (d.code === "CLOSED") setBlockMsg("응시할 수 없는 시험입니다.");
          else setBlockMsg(d.error ?? "시험을 불러올 수 없습니다.");
          setPhase("blocked");
          return;
        }

        const serverMap: AnswerMap = {};
        (d.answers ?? []).forEach((a) => { serverMap[a.questionNo] = { choice: a.choice, textAnswer: a.textAnswer }; });

        // 로컬 백업 복구 판정(문항별 last-write-wins)
        const local = readLocalBackup(d.attempt.id);
        const recoverNos: number[] = [];
        if (local && d.attempt.status === "in_progress") {
          for (const q of d.questions ?? []) {
            const no = q.number;
            const lu = local.updatedAt[no];
            if (!lu) continue;
            const serverA = (d.answers ?? []).find((a) => a.questionNo === no);
            const serverU = serverA ? Date.parse(serverA.updatedAt) : 0;
            const la = local.answers[no];
            if (la && lu > serverU) {
              const differs = !serverA || la.choice !== serverA.choice || (la.textAnswer ?? null) !== (serverA.textAnswer ?? null);
              if (differs) recoverNos.push(no);
            }
          }
        }

        answersRef.current = serverMap;
        setAnswers(serverMap);
        setExam(d.exam);
        setQuestions((d.questions ?? []).slice().sort((a, b) => a.number - b.number));
        setAttempt(d.attempt);
        setServerNow(d.serverNow ?? null);
        setPhase("ready");
        if (recoverNos.length && local) setRecovery({ nos: recoverNos, local });
      } catch {
        if (alive) { setBlockMsg("네트워크 오류가 발생했습니다."); setPhase("blocked"); }
      }
    })();
    return () => { alive = false; };
  }, [base, isStudent]);

  const onLocked = useCallback((status: string) => {
    setAttempt((a) => (a ? { ...a, status } : a));
  }, []);

  const autosave = useAutosave({
    url: `${base}/attempt/save`,
    attemptId: attempt?.id ?? "",
    getAnswers: () => answersRef.current,
    active: phase === "ready" && !readOnly && !!attempt,
    onLocked,
  });

  const setMcq = useCallback((no: number, v: number | null) => {
    if (readOnly) return;
    const next = { ...answersRef.current, [no]: { choice: v, textAnswer: null } };
    answersRef.current = next;
    setAnswers(next);
    autosave.markChanged(no);
  }, [readOnly, autosave]);

  const setText = useCallback((no: number, v: string) => {
    if (readOnly) return;
    const next = { ...answersRef.current, [no]: { choice: null, textAnswer: v } };
    answersRef.current = next;
    setAnswers(next);
    autosave.markChanged(no);
  }, [readOnly, autosave]);

  const doSubmit = useCallback(async () => {
    if (submitting || !attempt) return;
    setSubmitting(true);
    try {
      autosave.stop();
      const payload = Object.entries(answersRef.current).map(([no, a]) => ({ questionNo: Number(no), choice: a.choice, textAnswer: a.textAnswer }));
      const res = await fetch(`${base}/attempt/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: payload }) });
      const d = (await res.json().catch(() => ({}))) as { status?: string };
      if (res.ok) {
        setAttempt((a) => (a ? { ...a, status: d.status ?? "submitted", submittedAt: new Date().toISOString() } : a));
        clearLocalBackup(attempt.id);
      }
    } catch {
      /* 제출 실패 시 재시도 가능하도록 상태 유지 */
    } finally {
      setSubmitting(false);
      setShowSubmit(false);
    }
  }, [submitting, attempt, base, autosave]);

  const handleTimeUp = useCallback(() => { void doSubmit(); }, [doSubmit]);

  const remainingMs = useExamTimer(
    attempt?.status === "in_progress" ? attempt.deadlineAt : null,
    serverNow,
    handleTimeUp
  );

  const applyRecovery = useCallback(() => {
    if (!recovery) return;
    const next = { ...answersRef.current };
    recovery.nos.forEach((no) => { const la = recovery.local.answers[no]; if (la) next[no] = la; });
    answersRef.current = next;
    setAnswers(next);
    recovery.nos.forEach((no) => autosave.markChanged(no));
    setRecovery(null);
  }, [recovery, autosave]);

  const isAnswered = useCallback((q: Question, a?: { choice: number | null; textAnswer: string | null }) => {
    if (!a) return false;
    return q.type === "mcq" ? a.choice != null : !!(a.textAnswer && a.textAnswer.trim());
  }, []);

  const unanswered = useMemo(() => questions.filter((q) => !isAnswered(q, answers[q.number])).map((q) => q.number), [questions, answers, isAnswered]);
  const answeredCount = questions.length - unanswered.length;

  async function leave() {
    try { await autosave.flushNow(); } catch { /* 무시 */ }
    router.push(`/course/${courseId}/exam`);
  }
  function scrollToQ(no: number) {
    document.getElementById(`q-${no}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setShowSubmit(false);
  }

  if (phase === "loading") return <div className="mx-auto max-w-[640px] px-6 py-40 text-center" style={{ color: SUB }}>불러오는 중…</div>;
  if (phase === "blocked") {
    return (
      <div className="mx-auto max-w-[560px] px-6 py-32 text-center">
        <p className="text-[16px]" style={{ color: BODY }}>{blockMsg}</p>
        <button onClick={() => router.push(`/course/${courseId}/exam`)} className="mt-6 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: BROWN }}>시험 목록으로</button>
      </div>
    );
  }

  const danger = remainingMs != null && remainingMs <= 60_000;
  const warn = remainingMs != null && remainingMs <= 300_000 && !danger;
  const timerColor = danger ? "#C0392B" : warn ? "#B06B2E" : INK;

  return (
    <div style={{ background: "#fff", color: BODY }}>
      {/* 상단 고정 바 */}
      <div className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur" style={{ borderColor: LINE }}>
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold" style={{ ...serif, color: INK }}>{exam?.title}</h1>

          {readOnly ? (
            <span className="rounded-full px-3 py-1 text-[13px] font-bold" style={{ background: attempt?.status === "submitted" ? "#E9F3EC" : "#F2ECEC", color: attempt?.status === "submitted" ? "#3E7E5B" : "#a6402c" }}>
              {attempt?.status === "submitted" ? "제출 완료" : "시간 종료"}
            </span>
          ) : (
            <span className={`font-mono text-[19px] font-bold tabular-nums ${danger ? "animate-pulse" : ""}`} style={{ color: timerColor }}>
              {remainingMs == null ? "--:--" : fmtClock(remainingMs)}
            </span>
          )}

          {!readOnly ? (
            <span className="text-[12.5px]" style={{ color: autosave.state === "error" ? "#C0392B" : SUB }}>
              {autosave.state === "saving" ? "저장 중…" : autosave.state === "error" ? "⚠ 저장 실패 — 재시도 중" : autosave.state === "saved" ? `저장됨 · ${relTime(autosave.lastSavedAt)}` : ""}
            </span>
          ) : null}

          <span className="text-[13px] font-semibold" style={{ color: DEEP }}>{answeredCount}/{questions.length}</span>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPdfOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-semibold lg:hidden" style={{ borderColor: LINE, color: BODY }}><FileText size={14} /> 시험지</button>
            <button type="button" onClick={leave} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: LINE, color: SUB }}><LogOut size={14} /> 나가기</button>
            {!readOnly ? (
              <button type="button" onClick={() => setShowSubmit(true)} className="inline-flex items-center gap-1 rounded-[8px] px-4 py-1.5 text-[12.5px] font-bold text-white" style={{ background: BROWN }}><Send size={14} /> 제출하기</button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 복구 배너 */}
      {recovery ? (
        <div className="mx-auto mt-4 max-w-[900px] px-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-4" style={{ borderColor: "#E4C58A", background: "#FBF3E1" }}>
            <p className="text-[13.5px]" style={{ color: DEEP }}>저장되지 않은 답안이 {recovery.nos.length}문항 있습니다. 불러올까요?</p>
            <div className="flex gap-2">
              <button onClick={applyRecovery} className="rounded-[8px] px-4 py-1.5 text-[13px] font-bold text-white" style={{ background: BROWN }}>불러오기</button>
              <button onClick={() => setRecovery(null)} className="rounded-[8px] border px-4 py-1.5 text-[13px] font-semibold" style={{ borderColor: LINE, color: SUB }}>무시</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 본문: 좌 시험지 뷰어(문제 페이지만) + 우 답안지 */}
      <div className="lg:flex lg:items-start">
        {/* 시험지 PDF 뷰어 — 데스크톱은 좌측 고정, 모바일은 토글 */}
        <div className={`${pdfOpen ? "block" : "hidden"} border-b lg:sticky lg:top-[53px] lg:block lg:w-[48%] lg:shrink-0 lg:self-start lg:border-b-0 lg:border-r`} style={{ borderColor: LINE }}>
          <iframe src={`${base}/paper`} title="시험지" className="h-[62vh] w-full lg:h-[calc(100vh-53px)]" style={{ background: PANEL }} />
        </div>

        {/* 답안지 */}
        <main className="min-w-0 flex-1 px-5 pb-40 pt-6 lg:px-8">
          <div className="mx-auto max-w-[680px]">
            {readOnly ? (
              <p className="mb-5 rounded-[10px] px-4 py-3 text-[13.5px]" style={{ background: PANEL, color: SUB }}>제출/종료된 답안은 읽기 전용입니다.</p>
            ) : (
              <p className="mb-5 text-[13.5px]" style={{ color: SUB }}>
                <span className="hidden lg:inline">왼쪽 시험지를 보며 </span>
                <span className="lg:hidden">위 <b>시험지</b> 버튼으로 문제를 확인하고 </span>
                아래에 답을 표기하세요.
              </p>
            )}

            <div className="divide-y" style={{ borderColor: "#F0EBE0" }}>
              {questions.map((q) => {
                const a = answers[q.number];
                return (
                  <div key={q.number} className="py-3" id={`q-${q.number}`}>
                    {q.type === "mcq" ? (
                      <OmrRow number={q.number} choiceCount={q.choiceCount} value={a?.choice ?? null} onChange={(v) => setMcq(q.number, v)} disabled={readOnly} />
                    ) : (
                      <div className="flex items-start gap-3 py-1">
                        <div className="flex w-10 shrink-0 items-center gap-1.5 pt-2">
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: !(a?.textAnswer && a.textAnswer.trim()) ? "#D9B24A" : "transparent" }} aria-hidden />
                          <span className="text-[15px] font-bold" style={{ color: INK }}>{q.number}</span>
                        </div>
                        <AutoTextarea value={a?.textAnswer ?? ""} onChange={(v) => setText(q.number, v)} disabled={readOnly} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!readOnly ? (
              <div className="mt-8 flex justify-end">
                <button type="button" onClick={() => setShowSubmit(true)} className="inline-flex items-center gap-1.5 rounded-[10px] px-7 py-3 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN }}>
                  <Send size={16} /> 제출하기
                </button>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* 제출 모달 */}
      {showSubmit ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSubmit(false)}>
          <div className="w-full max-w-md rounded-[16px] bg-white p-6" style={{ border: `1px solid ${LINE}` }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[18px] font-semibold" style={{ ...serif, color: INK }}>답안을 제출할까요?</h3>
            {unanswered.length > 0 ? (
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: "#B06B2E" }}><AlertTriangle size={15} /> 미응답 {unanswered.length}문항이 있습니다.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unanswered.map((no) => (
                    <button key={no} onClick={() => scrollToQ(no)} className="rounded-md border px-2 py-1 text-[12.5px] font-semibold" style={{ borderColor: "#E4C58A", color: DEEP }}>{no}</button>
                  ))}
                </div>
                <p className="mt-2 text-[12.5px]" style={{ color: SUB }}>번호를 누르면 해당 문항으로 이동합니다. 그래도 제출할까요?</p>
              </div>
            ) : (
              <p className="mt-3 text-[14px]" style={{ color: BODY }}>모든 문항에 답했습니다. 제출하면 수정할 수 없습니다.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowSubmit(false)} className="rounded-[8px] border px-4 py-2 text-[14px] font-semibold" style={{ borderColor: LINE, color: SUB }}>계속 풀기</button>
              <button onClick={() => void doSubmit()} disabled={submitting} className="rounded-[8px] px-5 py-2 text-[14px] font-bold text-white disabled:opacity-60" style={{ background: BROWN }}>{submitting ? "제출 중…" : "제출하기"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 자동 높이 조절 textarea(주관식). */
function AutoTextarea({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => { resize(); }, [value, resize]);
  return (
    <textarea
      ref={ref}
      value={value}
      disabled={disabled}
      onChange={(e) => { onChange(e.target.value); resize(); }}
      placeholder="답을 입력하세요"
      rows={2}
      className="min-w-0 flex-1 resize-none rounded-[8px] border bg-white px-3 py-2 text-[15px] leading-7 outline-none focus:border-[#8C6E59] disabled:bg-[#FAFAF7]"
      style={{ borderColor: LINE, color: BODY }}
    />
  );
}
