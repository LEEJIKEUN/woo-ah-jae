"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, X, Check, Loader2, Sparkles } from "lucide-react";

const BROWN = "#8C6E59";
const NUM = "#B58F72";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type QType = "mcq" | "short";
type QRow = { id: string; type: QType; choiceCount: number; points: number; answerKey: string };
type Student = { id: string; name: string };

let seq = 0;
const newRow = (type: QType): QRow => ({ id: `q${++seq}`, type, choiceCount: 5, points: 1, answerKey: "" });

/** 100점 만점 균등 분배(합이 정확히 100이 되도록 나머지는 앞 문항에). */
function distributePoints(n: number, total = 100): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export default function ExamCreateForm({ courseId, examId }: { courseId: string; examId?: string }) {
  const router = useRouter();
  const editMode = !!examId;
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [paper, setPaper] = useState<File | null>(null);
  const [paperErr, setPaperErr] = useState("");
  const [rows, setRows] = useState<QRow[]>([]);
  const [addMcqN, setAddMcqN] = useState(20);
  const [addMcqChoices, setAddMcqChoices] = useState(5);
  const [addShortN, setAddShortN] = useState(5);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [studentPages, setStudentPages] = useState<string>(""); // 학생에게 보여줄 앞 페이지 수(문제만)
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/exam/students`, { cache: "no-store" });
        const d = (await res.json()) as { students?: Student[] };
        setStudents(d.students ?? []);
      } catch { /* 무시 */ }
    })();
  }, [courseId]);

  // 수정 모드: 기존 시험 불러와 프리필
  useEffect(() => {
    if (!examId) return;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/exam/${examId}`, { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { title: string; subject: string; durationMin: number; opensAt: string; closesAt: string; studentPageCount: number; questions: { type: string; choiceCount: number; points: number; answerKey: string }[]; studentIds: string[] };
        setTitle(d.title ?? "");
        setSubject(d.subject ?? "");
        setDurationMin(d.durationMin ?? 60);
        setOpensAt(d.opensAt ?? "");
        setClosesAt(d.closesAt ?? "");
        setStudentPages(d.studentPageCount ? String(d.studentPageCount) : "");
        setRows((d.questions ?? []).map((q) => ({ id: `q${++seq}`, type: q.type === "short" ? "short" : "mcq", choiceCount: q.type === "short" ? 5 : q.choiceCount, points: q.points, answerKey: q.answerKey })));
        setSelected(new Set(d.studentIds ?? []));
        setAiNote("기존 시험을 불러왔습니다. 수정 후 저장하세요. (새 PDF를 올리면 문항·정답이 다시 구성됩니다.)");
      } catch { /* 무시 */ }
    })();
  }, [courseId, examId]);

  function pickFile(f: File | null) {
    setPaperErr("");
    setAiNote("");
    if (!f) { setPaper(null); return; }
    if (f.type !== "application/pdf") { setPaperErr("PDF 파일만 업로드할 수 있습니다."); return; }
    if (f.size > 10 * 1024 * 1024) { setPaperErr("10MB 이하만 업로드할 수 있습니다."); return; }
    setPaper(f);
    void autoConfig(f); // 업로드 즉시 AI 자동 구성
  }

  /** PDF(문제+빠른정답+해설)를 AI로 분석해 문항·정답·배점(100점 균등)을 자동 채운다. */
  async function autoConfig(file: File) {
    setAnalyzing(true);
    setAiNote("");
    try {
      const fd = new FormData();
      fd.append("paper", file);
      const res = await fetch(`/api/courses/${courseId}/exam/analyze`, { method: "POST", body: fd });
      const d = (await res.json().catch(() => ({}))) as { questions?: { type: QType; choiceCount: number; answerKey: string }[]; answerStartPage?: number | null; error?: string };
      if (!res.ok || !d.questions) { setAiNote(d.error ?? "자동 구성에 실패했습니다. 아래에서 직접 구성할 수 있어요."); return; }
      const qs = d.questions;
      const pts = distributePoints(qs.length);
      setRows(qs.map((q, i) => ({ id: `q${++seq}`, type: q.type === "short" ? "short" : "mcq", choiceCount: q.type === "short" ? 5 : q.choiceCount, points: pts[i], answerKey: q.answerKey })));
      const mcq = qs.filter((q) => q.type === "mcq").length;
      // 빠른정답·해설 앞까지가 학생용 시험지 페이지
      if (typeof d.answerStartPage === "number" && d.answerStartPage > 1) setStudentPages(String(d.answerStartPage - 1));
      const pageNote = typeof d.answerStartPage === "number" && d.answerStartPage > 1 ? ` 학생에게는 앞 ${d.answerStartPage - 1}페이지(문제)만 제공됩니다.` : "";
      setAiNote(`AI가 ${qs.length}문항(객관식 ${mcq} · 주관식 ${qs.length - mcq})을 구성하고 정답을 채웠습니다. 배점은 100점 균등 분배.${pageNote} 검토 후 보내기 하세요.`);
    } catch {
      setAiNote("자동 구성 중 오류가 발생했습니다. 아래에서 직접 구성할 수 있어요.");
    } finally {
      setAnalyzing(false);
    }
  }

  const rebalance = () => setRows((prev) => { const pts = distributePoints(prev.length); return prev.map((r, i) => ({ ...r, points: pts[i] })); });

  const addRows = (type: QType, n: number, choiceCount = 5) => {
    const cnt = Math.max(0, Math.min(200, Math.trunc(n)));
    setRows((prev) => [...prev, ...Array.from({ length: cnt }, () => ({ ...newRow(type), choiceCount }))]);
  };
  const patchRow = (id: string, patch: Partial<QRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const allSelected = students.length > 0 && selected.size === students.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)));
  const toggleOne = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totalPoints = useMemo(() => rows.reduce((s, r) => s + (Number(r.points) || 0), 0), [rows]);

  async function submit(status: "published" | "draft") {
    if (!title.trim()) { alert("시험 제목을 입력하세요."); return; }
    if (!paper && !editMode) { alert("시험지 PDF를 첨부하세요."); return; } // 수정 모드는 기존 시험지 유지 가능
    if (!Number.isFinite(durationMin) || durationMin <= 0) { alert("제한시간을 올바르게 입력하세요."); return; }
    if (rows.length === 0) { alert("문항을 1개 이상 구성하세요."); return; }
    if (status === "published" && selected.size === 0) { alert("발송할 학생을 1명 이상 선택하세요."); return; }

    const toISO = (s: string) => (s ? new Date(`${s}:00+09:00`).toISOString() : "");
    const payload = {
      title: title.trim(),
      subject: subject.trim(),
      durationMin: Number(durationMin),
      opensAt: toISO(opensAt),
      closesAt: toISO(closesAt),
      status,
      questions: rows.map((r) => ({ type: r.type, choiceCount: r.choiceCount, points: Number(r.points) || 0, answerKey: r.answerKey.trim() })),
      studentIds: [...selected],
      studentPageCount: Number(studentPages) > 0 ? Math.trunc(Number(studentPages)) : 0,
    };
    const fd = new FormData();
    if (paper) fd.append("paper", paper);
    fd.append("payload", JSON.stringify(payload));

    setSubmitting(true);
    try {
      const url = editMode ? `/api/courses/${courseId}/exam/${examId}` : `/api/courses/${courseId}/exam`;
      const res = await fetch(url, { method: editMode ? "PATCH" : "POST", body: fd });
      const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) { alert(d.error ?? (editMode ? "시험 수정에 실패했습니다." : "시험 생성에 실패했습니다.")); return; }
      router.push(`/course/${courseId}/exam`);
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-[10px] border px-4 py-2.5 text-[15px] outline-none focus:border-[#8C6E59]";

  return (
    <div style={{ background: "#fff", color: BODY }}>
      <div className="mx-auto max-w-[860px] px-6 pt-16 pb-32">
        <Link href={`/course/${courseId}/exam`} className="text-[13px]" style={{ color: BROWN }}>← 시험 목록</Link>
        <p className="mt-4 text-center text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.24em", color: NUM }}>{editMode ? "EDIT EXAM" : "NEW EXAM"}</p>
        <h1 className="mt-3 text-center text-[30px] font-normal md:text-[36px]" style={{ ...serif, color: INK, letterSpacing: "-0.03em" }}>{editMode ? "시험 수정" : "시험 만들기"}</h1>
        <p className="mt-3 text-center text-[14px]" style={{ color: SUB }}>{editMode ? "시험 내용·학생을 수정하고 다시 저장·발송합니다. 시험지 PDF는 새로 올릴 때만 교체됩니다." : "시험지 PDF와 제한시간·문항 구성을 설정하고, 응시할 학생을 선택해 보냅니다."}</p>

        <div className="mt-12 space-y-8">
          {/* 기본 정보 */}
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="시험 제목" required><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 3주차 중간 점검" className={inputCls} style={{ borderColor: LINE, color: INK }} /></Field>
            <Field label="과목(선택)"><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 선형대수학" className={inputCls} style={{ borderColor: LINE, color: INK }} /></Field>
            <Field label="제한시간(분)" required><input type="number" min={1} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className={inputCls} style={{ borderColor: LINE, color: INK }} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="응시 시작(선택)"><input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className={inputCls} style={{ borderColor: LINE, color: INK }} /></Field>
              <Field label="응시 마감(선택)"><input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={inputCls} style={{ borderColor: LINE, color: INK }} /></Field>
            </div>
          </div>

          {/* 시험지 PDF */}
          <Field label="시험지 PDF" required>
            <div className="rounded-[12px] border border-dashed p-5" style={{ borderColor: paperErr ? "#C0392B" : LINE, background: PANEL }}>
              {paper ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[14px]" style={{ color: BODY }}><FileText size={17} style={{ color: BROWN }} /> <span className="truncate">{paper.name}</span> <span className="shrink-0" style={{ color: SUB }}>({Math.round(paper.size / 1024)}KB)</span></span>
                  <button type="button" onClick={() => { setPaper(null); if (fileRef.current) fileRef.current.value = ""; }} className="shrink-0 text-[13px] font-semibold" style={{ color: "#a6402c" }}>삭제</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-[8px] py-3 text-[14px] font-semibold" style={{ color: BROWN }}>{editMode ? "＋ 새 PDF 선택 (안 올리면 기존 시험지 유지 · 올리면 교체·자동 재구성)" : "＋ PDF 선택 (업로드하면 문항·정답 자동 구성 · 최대 10MB)"}</button>
              )}
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </div>
            {paperErr ? <p className="mt-1.5 text-[12.5px]" style={{ color: "#C0392B" }}>{paperErr}</p> : null}
            {analyzing ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: BROWN }}><Loader2 size={14} className="animate-spin" /> AI가 시험지를 분석하는 중… (문항·정답 자동 구성)</p>
            ) : aiNote ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px]" style={{ color: SUB }}>{aiNote}</p>
                {paper ? <button type="button" onClick={() => void autoConfig(paper)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: BROWN }}><Sparkles size={13} /> 다시 분석</button> : null}
              </div>
            ) : null}
            {paper ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border p-3" style={{ borderColor: LINE, background: PANEL }}>
                <span className="text-[12.5px] font-semibold" style={{ color: INK }}>학생에게 보여줄 시험지:</span>
                <span className="text-[12.5px]" style={{ color: SUB }}>앞</span>
                <input type="number" min={1} value={studentPages} onChange={(e) => setStudentPages(e.target.value)} placeholder="전체" className="w-20 rounded-md border px-2 py-1 text-[13px]" style={{ borderColor: LINE }} />
                <span className="text-[12.5px]" style={{ color: SUB }}>페이지 (빠른정답·해설 제외 · 비워두면 전체)</span>
              </div>
            ) : null}
          </Field>

          {/* 문항 구성 */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13.5px] font-semibold" style={{ color: INK }}>문항 구성 <span style={{ color: SUB }}>· {rows.length}문항 · 총 {totalPoints}점</span></span>
              {rows.length > 0 ? <button type="button" onClick={rebalance} className="text-[12.5px] font-semibold" style={{ color: BROWN }}>100점 균등 분배</button> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-[10px] border p-3" style={{ borderColor: LINE, background: PANEL }}>
              <label className="text-[12.5px]" style={{ color: SUB }}>객관식
                <input type="number" min={0} value={addMcqN} onChange={(e) => setAddMcqN(Number(e.target.value))} className="ml-1 w-16 rounded-md border px-2 py-1 text-[13px]" style={{ borderColor: LINE }} />문항
              </label>
              <label className="text-[12.5px]" style={{ color: SUB }}>보기
                <input type="number" min={2} max={10} value={addMcqChoices} onChange={(e) => setAddMcqChoices(Number(e.target.value))} className="ml-1 w-14 rounded-md border px-2 py-1 text-[13px]" style={{ borderColor: LINE }} />개
              </label>
              <button type="button" onClick={() => addRows("mcq", addMcqN, addMcqChoices)} className="rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: BROWN }}>추가</button>
              <span className="mx-1 h-5 w-px" style={{ background: LINE }} />
              <label className="text-[12.5px]" style={{ color: SUB }}>주관식
                <input type="number" min={0} value={addShortN} onChange={(e) => setAddShortN(Number(e.target.value))} className="ml-1 w-16 rounded-md border px-2 py-1 text-[13px]" style={{ borderColor: LINE }} />문항
              </label>
              <button type="button" onClick={() => addRows("short", addShortN)} className="rounded-md border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: BROWN, color: BROWN }}>추가</button>
            </div>

            {rows.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {rows.map((r, i) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-[8px] border px-3 py-2" style={{ borderColor: LINE }}>
                    <span className="w-8 text-[13px] font-bold" style={{ color: INK }}>{i + 1}</span>
                    <select value={r.type} onChange={(e) => patchRow(r.id, { type: e.target.value as QType })} className="rounded-md border px-2 py-1 text-[13px]" style={{ borderColor: LINE }}>
                      <option value="mcq">객관식</option>
                      <option value="short">주관식</option>
                    </select>
                    {r.type === "mcq" ? (
                      <label className="text-[12px]" style={{ color: SUB }}>보기<input type="number" min={2} max={10} value={r.choiceCount} onChange={(e) => patchRow(r.id, { choiceCount: Number(e.target.value) })} className="ml-1 w-14 rounded-md border px-2 py-1 text-[12.5px]" style={{ borderColor: LINE }} /></label>
                    ) : null}
                    <label className="text-[12px]" style={{ color: SUB }}>배점<input type="number" min={0} step={0.5} value={r.points} onChange={(e) => patchRow(r.id, { points: Number(e.target.value) })} className="ml-1 w-16 rounded-md border px-2 py-1 text-[12.5px]" style={{ borderColor: LINE }} /></label>
                    <input value={r.answerKey} onChange={(e) => patchRow(r.id, { answerKey: e.target.value })} placeholder="정답(선택·비공개)" className="min-w-0 flex-1 rounded-md border px-2 py-1 text-[12.5px]" style={{ borderColor: LINE }} />
                    <button type="button" onClick={() => removeRow(r.id)} aria-label="삭제" style={{ color: SUB }}><X size={15} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px]" style={{ color: SUB }}>위에서 문항을 추가하세요. 문제 내용은 PDF에 있으므로 여기서는 유형·보기수·배점·정답(선택)만 설정합니다.</p>
            )}
          </div>

          {/* 학생 선택 */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13.5px] font-semibold" style={{ color: INK }}>보낼 학생 <span style={{ color: SUB }}>· {selected.size}/{students.length}명</span></span>
              {students.length > 0 ? <button type="button" onClick={toggleAll} className="text-[12.5px] font-semibold" style={{ color: BROWN }}>{allSelected ? "전체 해제" : "전체 선택"}</button> : null}
            </div>
            {students.length === 0 ? (
              <p className="mt-2 text-[13px]" style={{ color: SUB }}>수강생이 없습니다.</p>
            ) : (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                {students.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleOne(s.id)} className="flex items-center gap-2 rounded-[8px] border px-3 py-2 text-left text-[13.5px]" style={{ borderColor: on ? BROWN : LINE, background: on ? "#FBF3E8" : "#fff", color: INK }}>
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded border" style={{ borderColor: on ? BROWN : LINE, background: on ? BROWN : "#fff" }}>{on ? <Check size={12} color="#fff" /> : null}</span>
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => router.push(`/course/${courseId}/exam`)} className="rounded-[8px] border px-8 py-3 text-[15px]" style={{ borderColor: LINE, color: SUB, ...serif }}>취소</button>
          <button type="button" onClick={() => void submit("draft")} disabled={submitting} className="rounded-[8px] border px-7 py-3 text-[15px] font-semibold disabled:opacity-60" style={{ borderColor: BROWN, color: BROWN, ...serif }}>임시저장</button>
          <button type="button" onClick={() => void submit("published")} disabled={submitting} className="rounded-[8px] px-10 py-3 text-[15px] font-bold text-white disabled:opacity-60" style={{ background: BROWN, ...serif, boxShadow: "0 2px 10px rgba(140,110,89,0.25)" }}>{submitting ? (editMode ? "저장 중…" : "보내는 중…") : editMode ? "수정 저장·발송" : "보내기"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold" style={{ color: INK }}>{label}{required ? <span style={{ color: "#C0392B" }}> *</span> : null}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
