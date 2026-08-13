"use client";

import { useState } from "react";
import { Send, X, Shuffle, Users } from "lucide-react";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";

type Student = { id: string; name: string; assignmentCount: number };

/** 과제 헤더의 종이비행기 버튼 → '과제 보내기'(상호 피드백 배포) 모달. */
export default function PeerReviewButton({ courseId, column, label, students }: { courseId: string; column: number; label: string; students: Student[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(3);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 배정 현황 팝업
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusRows, setStatusRows] = useState<{ recipientId: string; recipientName: string; items: { authorName: string; fileName: string; assignmentId: string }[] }[]>([]);
  async function openStatus() {
    setStatusOpen(true);
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/peer-review?column=${column}`, { cache: "no-store" });
      const d = (await res.json()) as { rows?: typeof statusRows };
      setStatusRows(Array.isArray(d.rows) ? d.rows : []);
    } catch {
      setStatusRows([]);
    } finally {
      setStatusLoading(false);
    }
  }

  const canReview = (s: Student) => s.assignmentCount > column; // 이 과제(column)를 제출했는지
  const submitters = students.filter(canReview);
  const allSelected = submitters.length > 0 && selected.size === submitters.length;
  function toggle(id: string) {
    const s = students.find((x) => x.id === id);
    if (!s || !canReview(s)) return; // 미제출자는 선택 불가
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(submitters.map((s) => s.id)));
  }
  function close() {
    setOpen(false);
    setMsg(null);
  }

  async function send() {
    if (selected.size < 2) {
      setMsg({ ok: false, text: "학생을 2명 이상 선택하세요." });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/peer-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column, studentIds: [...selected], count }),
      });
      const d = (await res.json()) as { error?: string; assigned?: number; recipients?: number; perAssignment?: number; warn?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: d.error ?? "배포에 실패했습니다." });
      } else if (d.warn) {
        setMsg({ ok: false, text: d.warn });
      } else {
        setMsg({ ok: true, text: `배포 완료 — 참여 ${d.recipients}명 · 각 과제 ${d.perAssignment}회씩 균등 배부(총 ${d.assigned}건).` });
      }
    } catch {
      setMsg({ ok: false, text: "네트워크 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition hover:bg-[#EFEBE1]"
        style={{ color: BROWN }}
        title={`${label} 상호 피드백으로 보내기`}
        aria-label={`${label} 상호 피드백 보내기`}
      >
        <Send size={13} />
      </button>
      <button
        type="button"
        onClick={() => void openStatus()}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition hover:bg-[#EFEBE1]"
        style={{ color: BROWN }}
        title={`${label} 배정 현황 보기`}
        aria-label={`${label} 배정 현황`}
      >
        <Users size={13} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div className="flex max-h-[85vh] w-full max-w-[560px] flex-col rounded-[16px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: CARD }}>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: BROWN }}><Send size={15} /></span>
                <div>
                  <p className="text-[15px] font-bold" style={{ color: INK }}>과제 보내기</p>
                  <p className="text-[12px]" style={{ color: SUB }}>{label} · 상호 피드백 배포</p>
                </div>
              </div>
              <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="닫기"><X size={18} /></button>
            </div>

            {/* 본문: 좌(학생 선택) · 우(랜덤 개수) */}
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-[1fr_150px]">
              {/* 좌: 학생 선택 */}
              <div className="min-h-0">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-bold" style={{ color: INK }}>학생 선택</span>
                  <span className="text-[12px]" style={{ color: MUTED }}>제출 {submitters.length}명 · 선택 {selected.size}명</span>
                </div>
                <label className="mb-1.5 flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: BROWN, background: PANEL }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#8C6E59]" />
                  제출자 전체 선택
                </label>
                <div className="max-h-[320px] space-y-0.5 overflow-y-auto rounded-[8px] border p-1.5" style={{ borderColor: LINE }}>
                  {students.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[12.5px]" style={{ color: SUB }}>수강생이 없습니다.</p>
                  ) : (
                    students.map((s, i) => {
                      const ok = canReview(s);
                      return (
                        <label key={s.id} className={`flex items-center gap-2 rounded-[6px] px-2.5 py-2 text-[13px] ${ok ? "cursor-pointer hover:bg-[#FBF8F2]" : "cursor-not-allowed opacity-50"}`} style={{ color: INK }}>
                          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} disabled={!ok} className="accent-[#8C6E59]" />
                          <span className="text-[11px]" style={{ color: MUTED }}>{i + 1}</span>
                          <span className="truncate font-medium">{s.name}</span>
                          {!ok ? <span className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#F3EEE4", color: "#a6402c" }}>미제출</span> : null}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 우: 랜덤 개수 */}
              <div>
                <span className="mb-2 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: INK }}><Shuffle size={13} style={{ color: BROWN }} /> 무작위(Random)</span>
                <p className="mb-2 text-[11.5px] leading-5" style={{ color: SUB }}>각 학생이 받을 다른 학생 과제 수</p>
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className="rounded-[8px] border py-2 text-[14px] font-bold transition"
                      style={count === n ? { background: BROWN, color: "#fff", borderColor: BROWN } : { borderColor: LINE, color: INK, background: "#fff" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="border-t px-5 py-4" style={{ borderColor: CARD }}>
              {msg ? <p className="mb-2 text-[12.5px]" style={{ color: msg.ok ? "#3E7E5B" : "#a6402c" }}>{msg.text}</p> : null}
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px]" style={{ color: MUTED }}>제출한 학생끼리 · 각자 본인 제외 {count}개 · 모든 과제 균등 배부(미제출 제외)</p>
                <button type="button" onClick={() => void send()} disabled={sending} className="shrink-0 rounded-[8px] px-6 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: BROWN }}>
                  {sending ? "보내는 중…" : "보내기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {statusOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setStatusOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-[16px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: CARD }}>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: BROWN }}><Users size={15} /></span>
                <div>
                  <p className="text-[15px] font-bold" style={{ color: INK }}>배정 현황</p>
                  <p className="text-[12px]" style={{ color: SUB }}>{label} · 누가 누구의 과제를 받았는지</p>
                </div>
              </div>
              <button type="button" onClick={() => setStatusOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="닫기"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {statusLoading ? (
                <p className="py-6 text-center text-[13px]" style={{ color: MUTED }}>불러오는 중…</p>
              ) : statusRows.length === 0 ? (
                <p className="py-6 text-center text-[13px]" style={{ color: SUB }}>아직 배정된 내역이 없습니다. 종이비행기로 먼저 배포하세요.</p>
              ) : (
                statusRows.map((r) => (
                  <div key={r.recipientId} className="rounded-[10px] border p-3" style={{ borderColor: LINE, background: PANEL }}>
                    <p className="mb-2 text-[13px]" style={{ color: INK }}>
                      <b>{r.recipientName}</b> 학생이 받은 과제 <span style={{ color: MUTED }}>({r.items.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.items.map((it, i) => (
                        <a
                          key={it.assignmentId + i}
                          href={`/api/courses/${courseId}/mentoring/assignment/${it.assignmentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-[8px] border bg-white px-2.5 py-1.5 text-[12px] font-medium transition hover:border-[#8C6E59]"
                          style={{ borderColor: LINE, color: INK }}
                          title={`${it.authorName} · ${it.fileName}`}
                        >
                          <span className="shrink-0 font-bold" style={{ color: BROWN }}>{i + 1}.</span>
                          <span className="shrink-0" style={{ color: SUB }}>{it.authorName}</span>
                          <span className="truncate" style={{ color: MUTED }}>· {it.fileName}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
