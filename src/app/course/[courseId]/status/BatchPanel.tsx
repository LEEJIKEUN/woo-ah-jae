"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileText, Lock, Play, RefreshCw, Send, Square, Undo2 } from "lucide-react";
import { ASSIGN_SLOTS, DOSSIER_SECTIONS, toggleSet } from "@/lib/mentoring/dossier-items";
import type { OverviewRow } from "@/lib/mentoring/overview";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";
const GREEN = "#2f7d55";
const RED = "#a6402c";

type Action = "dossier" | "sete" | "report" | "send" | "all";
type Progress = { status: "idle" | "running" | "done" | "error"; step: string; msg?: string };
const CONCURRENCY = 3; // 동시에 처리할 학생 수(AI 호출 과부하 방지)

/** ISO → "M/D HH:mm"(KST) */
function fmt(iso?: string | null): string {
  if (!iso) return "";
  try {
    const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    const hh = g("hour") === "24" ? "00" : g("hour");
    return `${g("month")}/${g("day")} ${hh}:${g("minute")}`;
  } catch {
    return "";
  }
}

/**
 * 세특·과제 현황 하단 '일괄 처리' — 학생을 여러 명 골라 ①정리 자료 생성 → ②AI 세특 생성·세특(참고) 반영 → ③평가 보고서 생성·보내기를
 * 한 번에 돌린다. 학생별 진행 상태를 줄마다 실시간 표시, 창에 다시 돌아오면 현황을 다시 읽는다(다른 탭 작업 반영).
 */
export default function BatchPanel({ courseId, initialRows }: { courseId: string; initialRows: OverviewRow[] }) {
  const [rows, setRows] = useState<OverviewRow[]>(initialRows);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [secs, setSecs] = useState<Set<string>>(() => new Set(DOSSIER_SECTIONS.map((x) => x.key)));
  const [cols, setCols] = useState<Set<number>>(() => new Set(ASSIGN_SLOTS));
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [running, setRunning] = useState<Action | null>(null);
  const [summary, setSummary] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const stopRef = useRef(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/mentoring/ai-eval/overview`, { cache: "no-store" });
      const d = (await res.json().catch(() => null)) as { rows?: OverviewRow[] } | null;
      if (res.ok && d && Array.isArray(d.rows)) setRows(d.rows);
    } catch {
      /* 무시 */
    } finally {
      setRefreshing(false);
    }
  }, [courseId]);

  // 다른 탭(멘토링 페이지)에서 작업하고 돌아오면 현황 재조회 — 실행 중엔 로컬 진행 상태를 덮지 않도록 건너뜀
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !stopRef.current && running === null) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh, running]);

  const patchRow = (id: string, fn: (r: OverviewRow) => OverviewRow) => setRows((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
  const setProg = (id: string, p: Progress) => setProgress((prev) => ({ ...prev, [id]: p }));

  async function post<T>(url: string, body?: object): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const d = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !d) throw new Error(d?.error ?? `실패 (${res.status})`);
    return d;
  }

  // ── 학생 1명 단계들 ──
  async function stepDossier(r: OverviewRow) {
    const include = {
      sections: [...secs].filter((k) => k !== "report_file" || r.hasReportFile),
      assignmentColumns: [...cols].filter((c) => r.submittedColumns.includes(c)),
    };
    if (!include.sections.length && !include.assignmentColumns.length) throw new Error("포함 항목이 비어 있습니다.");
    const d = await post<{ id: string; label: string; createdAt: string }>(`/api/courses/${courseId}/mentoring/ai-eval/files`, { studentId: r.id, kind: "dossier", include });
    patchRow(r.id, (x) => ({ ...x, dossier: { id: d.id, label: d.label, createdAt: d.createdAt } }));
  }
  async function stepSete(r: OverviewRow) {
    const d = await post<{ generatedAt: string; byteCount: number }>(`/api/courses/${courseId}/mentoring/ai-eval`, { studentId: r.id, applyToSete: true });
    patchRow(r.id, (x) => ({ ...x, aiEval: { generatedAt: d.generatedAt, byteCount: d.byteCount, edited: false, applied: true } }));
  }
  async function stepReport(r: OverviewRow): Promise<string> {
    const d = await post<{ id: string; label: string; createdAt: string }>(`/api/courses/${courseId}/mentoring/ai-eval/files`, { studentId: r.id, kind: "report" });
    patchRow(r.id, (x) => ({ ...x, report: { id: d.id, label: d.label, createdAt: d.createdAt, sentAt: null } }));
    return d.id;
  }
  async function stepSend(r: OverviewRow, fileId?: string) {
    const id = fileId ?? rowsRef.current.find((x) => x.id === r.id)?.report?.id;
    if (!id) throw new Error("보낼 평가 보고서가 없습니다. 먼저 생성하세요.");
    const d = await post<{ sentAt: string }>(`/api/courses/${courseId}/mentoring/ai-eval/files/${id}/send?studentId=${encodeURIComponent(r.id)}`);
    patchRow(r.id, (x) => ({ ...x, report: x.report && x.report.id === id ? { ...x.report, sentAt: d.sentAt } : { id, label: x.report?.label ?? "", createdAt: d.sentAt, sentAt: d.sentAt } }));
  }
  async function recall(r: OverviewRow) {
    if (!r.report?.id) return;
    try {
      const res = await fetch(`/api/courses/${courseId}/mentoring/ai-eval/files/${r.report.id}/send?studentId=${encodeURIComponent(r.id)}`, { method: "DELETE" });
      if (res.ok) patchRow(r.id, (x) => ({ ...x, report: x.report ? { ...x.report, sentAt: null } : null }));
    } catch {
      /* 무시 */
    }
  }

  async function runOne(r: OverviewRow, action: Action) {
    const steps: { label: string; fn: () => Promise<unknown> }[] = [];
    let reportId: string | undefined;
    if (action === "dossier" || action === "all") steps.push({ label: "① 정리 자료 생성", fn: () => stepDossier(r) });
    if (action === "sete" || action === "all") steps.push({ label: "② AI 세특 생성·반영", fn: () => stepSete(r) });
    if (action === "report" || action === "all") steps.push({ label: "③ 평가 보고서 생성", fn: async () => { reportId = await stepReport(r); } });
    if (action === "report" || action === "send" || action === "all") steps.push({ label: "보고서 보내기", fn: () => stepSend(r, reportId) });
    for (const st of steps) {
      if (stopRef.current) { setProg(r.id, { status: "error", step: st.label, msg: "중지됨" }); return false; }
      setProg(r.id, { status: "running", step: st.label });
      try {
        await st.fn();
      } catch (e) {
        setProg(r.id, { status: "error", step: st.label, msg: e instanceof Error ? e.message : "실패" });
        return false;
      }
    }
    setProg(r.id, { status: "done", step: "완료" });
    return true;
  }

  async function run(action: Action) {
    if (running) return;
    const targets = rows.filter((r) => selected.has(r.id));
    if (!targets.length) { setSummary({ ok: false, text: "학생을 먼저 선택하세요." }); return; }
    if ((action === "sete" || action === "all") && !window.confirm(`선택한 ${targets.length}명의 '세특(참고)' 칸을 새로 생성한 AI 세특으로 덮어씁니다. 계속할까요?`)) return;
    if ((action === "report" || action === "send" || action === "all") && !window.confirm(`선택한 ${targets.length}명에게 최종 평가 보고서를 보냅니다(학생 멘토링 페이지에서 내려받기 활성화). 계속할까요?`)) return;
    stopRef.current = false;
    setRunning(action);
    setSummary(null);
    setProgress((prev) => { const n = { ...prev }; for (const t of targets) n[t.id] = { status: "idle", step: "대기" }; return n; });
    let ok = 0;
    let fail = 0;
    const queue = [...targets];
    const worker = async () => {
      while (queue.length && !stopRef.current) {
        const r = queue.shift()!;
        if (await runOne(r, action)) ok += 1; else fail += 1;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    const stopped = stopRef.current;
    setRunning(null);
    setSummary({ ok: fail === 0 && !stopped, text: `완료 ${ok}명 · 실패 ${fail}명${stopped ? " · 중지됨(남은 학생은 처리하지 않음)" : ""}` });
    void refresh();
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const btn = (label: string, action: Action, primary = false, title?: string) => (
    <button
      type="button"
      onClick={() => void run(action)}
      disabled={!!running}
      title={title}
      className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12.5px] font-bold transition hover:opacity-90 disabled:opacity-50"
      style={primary ? { background: DEEP, color: "#fff", borderColor: DEEP } : { background: "#fff", color: DEEP, borderColor: BROWN }}
    >
      {running === action ? <RefreshCw size={12} className="animate-spin" /> : null}
      {label}
    </button>
  );

  const th = "whitespace-nowrap border-b px-2.5 py-2 text-left text-[12px] font-bold";
  const td = "border-b px-2.5 py-2 align-middle text-[12.5px]";

  return (
    <section className="mt-8 rounded-[12px] border" style={{ borderColor: CARD }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: CARD, background: PANEL }}>
        <div>
          <p className="text-[15px] font-bold" style={{ color: INK }}>일괄 처리 — 여러 학생을 한 번에</p>
          <p className="mt-0.5 text-[12px]" style={{ color: SUB }}>학생을 체크하고 버튼을 누르면 선택한 학생 전원에게 차례로 실행됩니다(동시 {CONCURRENCY}명). AI 단계는 학생당 1~2분이 걸릴 수 있습니다.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing || !!running} className="inline-flex items-center gap-1 rounded-[6px] border px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50" style={{ borderColor: LINE, color: SUB, background: "#fff" }}>
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> 현황 새로고침
        </button>
      </div>

      {/* 포함 항목(정리 자료 전용) */}
      <div className="border-b px-4 py-3" style={{ borderColor: CARD }}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold" style={{ color: INK }}>정리 자료 포함 항목 <span className="font-medium" style={{ color: MUTED }}>— ① 정리 자료 생성에만 적용. 미제출 과제·없는 첨부는 학생별로 자동 제외</span></span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
            <button type="button" onClick={() => { setSecs(new Set(DOSSIER_SECTIONS.map((x) => x.key))); setCols(new Set(ASSIGN_SLOTS)); }} className="hover:underline" style={{ color: BROWN }}>전체 선택</button>
            <span style={{ color: LINE }}>|</span>
            <button type="button" onClick={() => { setSecs(new Set()); setCols(new Set()); }} className="hover:underline" style={{ color: MUTED }}>전체 해제</button>
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {DOSSIER_SECTIONS.map((x) => (
            <label key={x.key} className="inline-flex cursor-pointer items-center gap-1 text-[12px]" style={{ color: INK }}>
              <input type="checkbox" className="accent-[#8C6E59]" checked={secs.has(x.key)} onChange={() => setSecs((p) => toggleSet(p, x.key))} />
              {x.label}
            </label>
          ))}
          <span className="mx-1 text-[12px]" style={{ color: LINE }}>|</span>
          {ASSIGN_SLOTS.map((c) => (
            <label key={c} className="inline-flex cursor-pointer items-center gap-1 text-[12px]" style={{ color: INK }}>
              <input type="checkbox" className="accent-[#8C6E59]" checked={cols.has(c)} onChange={() => setCols((p) => toggleSet(p, c))} />
              과제{c + 1}
            </label>
          ))}
        </div>
      </div>

      {/* 학생 표 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 860 }}>
          <thead>
            <tr style={{ background: PANEL, color: INK }}>
              <th className={th} style={{ borderColor: CARD, width: 36 }}>
                <input type="checkbox" className="accent-[#8C6E59]" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="전체 선택" />
              </th>
              <th className={th} style={{ borderColor: CARD, width: 110 }}>이름</th>
              <th className={th} style={{ borderColor: CARD }}>① 정리 자료</th>
              <th className={th} style={{ borderColor: CARD }}>② AI 세특</th>
              <th className={th} style={{ borderColor: CARD }}>③ 평가 보고서</th>
              <th className={th} style={{ borderColor: CARD }}>학생 공개</th>
              <th className={th} style={{ borderColor: CARD, minWidth: 180 }}>진행</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className={td} style={{ borderColor: CARD, color: SUB }} colSpan={7}>수강 중인 학생이 없습니다.</td></tr>
            ) : rows.map((r) => {
              const p = progress[r.id];
              return (
                <tr key={r.id} style={selected.has(r.id) ? { background: "#FDFBF7" } : undefined}>
                  <td className={td} style={{ borderColor: CARD }}>
                    <input type="checkbox" className="accent-[#8C6E59]" checked={selected.has(r.id)} onChange={() => setSelected((s) => toggleSet(s, r.id))} aria-label={`${r.name} 선택`} />
                  </td>
                  <td className={td} style={{ borderColor: CARD }}>
                    <Link href={`/course/${courseId}/mentoring?student=${r.id}`} className="font-semibold hover:underline" style={{ color: INK }}>{r.name}</Link>
                  </td>
                  <td className={td} style={{ borderColor: CARD, color: r.dossier ? INK : MUTED }}>
                    {r.dossier ? <span title={`정리 PDF(${r.dossier.label})`}>{fmt(r.dossier.createdAt)}{r.dossier.label.includes("·") ? <span className="ml-1 text-[11px]" style={{ color: SUB }}>· {r.dossier.label.split("·").slice(1).join("·").trim()}</span> : null}</span> : "-"}
                  </td>
                  <td className={td} style={{ borderColor: CARD, color: r.aiEval ? INK : MUTED }}>
                    {r.aiEval ? (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {fmt(r.aiEval.generatedAt)} <span className="text-[11px]" style={{ color: SUB }}>{r.aiEval.byteCount}byte{r.aiEval.edited ? " · 손수정" : ""}</span>
                        {r.aiEval.applied ? <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "#E8F3EC", color: GREEN }}><Check size={10} /> 세특(참고) 반영됨</span> : <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "#F3EEE4", color: SUB }}>미반영</span>}
                      </span>
                    ) : "-"}
                  </td>
                  <td className={td} style={{ borderColor: CARD, color: r.report ? INK : MUTED }}>
                    {r.report ? (
                      <a href={`/api/courses/${courseId}/mentoring/ai-eval/files/${r.report.id}?studentId=${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: BROWN }} title="열기">
                        <FileText size={12} /> {fmt(r.report.createdAt)}
                      </a>
                    ) : "-"}
                  </td>
                  <td className={td} style={{ borderColor: CARD }}>
                    {r.report?.sentAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-0.5 text-[12px] font-bold" style={{ color: GREEN }}><Check size={12} /> 보냄 {fmt(r.report.sentAt)}</span>
                        <button type="button" onClick={() => void recall(r)} disabled={!!running} className="inline-flex items-center gap-0.5 text-[11px] hover:underline disabled:opacity-50" style={{ color: MUTED }} title="학생 내려받기 잠금"><Undo2 size={11} /> 회수</button>
                      </span>
                    ) : r.report ? (
                      <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: MUTED }}><Lock size={11} /> 미전송</span>
                    ) : (
                      <span style={{ color: MUTED }}>-</span>
                    )}
                  </td>
                  <td className={td} style={{ borderColor: CARD }}>
                    {!p ? <span style={{ color: MUTED }}>-</span>
                      : p.status === "running" ? <span className="inline-flex items-center gap-1" style={{ color: BROWN }}><RefreshCw size={12} className="animate-spin" /> {p.step}…</span>
                      : p.status === "done" ? <span className="inline-flex items-center gap-1 font-semibold" style={{ color: GREEN }}><Check size={12} /> 완료</span>
                      : p.status === "error" ? <span style={{ color: RED }} title={p.msg}>✕ {p.step} 실패{p.msg ? ` — ${p.msg}` : ""}</span>
                      : <span style={{ color: MUTED }}>대기</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 실행 버튼 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-1 text-[12px] font-bold" style={{ color: SUB }}>선택 {selected.size}명</span>
        {btn("① 정리 자료 생성", "dossier")}
        {btn("② AI 세특 생성 → 세특(참고) 반영", "sete", false, "AI 세특을 새로 만들고 학생과 공유되는 세특(참고) 칸에 덮어씁니다")}
        {btn("③ 평가 보고서 생성 → 보내기", "report", false, "최종 평가 보고서를 만들고 바로 학생에게 보냅니다")}
        {btn("보내기만", "send", false, "이미 생성된 최신 평가 보고서를 학생에게 보냅니다")}
        <button type="button" onClick={() => void run("all")} disabled={!!running} className="inline-flex items-center gap-1 rounded-[8px] px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: BROWN }} title="①→②→③→보내기를 차례로 실행">
          {running === "all" ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} ①→③ 전체 실행
        </button>
        {running ? (
          <button type="button" onClick={() => { stopRef.current = true; }} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12.5px] font-bold" style={{ borderColor: RED, color: RED, background: "#fff" }}>
            <Square size={11} /> 중지
          </button>
        ) : null}
        {summary ? <span className="ml-auto text-[12.5px] font-semibold" style={{ color: summary.ok ? GREEN : RED }}>{summary.text}</span> : null}
      </div>
      <p className="px-4 pb-3 text-[11.5px]" style={{ color: MUTED }}>
        <Send size={11} className="mr-0.5 inline" /> 보내기를 하면 학생 멘토링 페이지(1:1 상담 채팅 위)의 「최종 평가 보고서 내려받기」가 바로 활성화됩니다. 회수하면 다시 잠깁니다.
      </p>
    </section>
  );
}
