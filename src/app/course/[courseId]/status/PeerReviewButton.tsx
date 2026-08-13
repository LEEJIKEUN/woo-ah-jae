"use client";

import { useState } from "react";
import { Send, X, Shuffle } from "lucide-react";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";

type Student = { id: string; name: string };

/** 과제 헤더의 종이비행기 버튼 → '과제 보내기'(상호 피드백 배포) 모달. */
export default function PeerReviewButton({ courseId, column, label, students }: { courseId: string; column: number; label: string; students: Student[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(3);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const allSelected = students.length > 0 && selected.size === students.length;
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)));
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
      const d = (await res.json()) as { error?: string; assigned?: number; recipients?: number; warn?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: d.error ?? "배포에 실패했습니다." });
      } else if (d.warn) {
        setMsg({ ok: false, text: d.warn });
      } else {
        setMsg({ ok: true, text: `배포 완료 — ${d.recipients}명에게 총 ${d.assigned}건 배정되었습니다.` });
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
                  <span className="text-[12px]" style={{ color: MUTED }}>{selected.size}명 선택</span>
                </div>
                <label className="mb-1.5 flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: BROWN, background: PANEL }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#8C6E59]" />
                  전체 선택
                </label>
                <div className="max-h-[320px] space-y-0.5 overflow-y-auto rounded-[8px] border p-1.5" style={{ borderColor: LINE }}>
                  {students.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[12.5px]" style={{ color: SUB }}>수강생이 없습니다.</p>
                  ) : (
                    students.map((s, i) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-2 text-[13px] hover:bg-[#FBF8F2]" style={{ color: INK }}>
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="accent-[#8C6E59]" />
                        <span className="text-[11px]" style={{ color: MUTED }}>{i + 1}</span>
                        <span className="truncate font-medium">{s.name}</span>
                      </label>
                    ))
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
                <p className="text-[12px]" style={{ color: MUTED }}>선택 학생들의 {label}에서 본인 제외 무작위 {count}개씩 배정</p>
                <button type="button" onClick={() => void send()} disabled={sending} className="shrink-0 rounded-[8px] px-6 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: BROWN }}>
                  {sending ? "보내는 중…" : "보내기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
