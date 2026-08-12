"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

const BROWN = "#8C6E59";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const BODY = "#334155";
const serif = { fontFamily: "var(--font-serif)" } as const;

/**
 * 사이드바 '강좌 소개' 박스. 관리자·퍼실은 인라인 편집(연필 아이콘) → DB(CourseSummary) 저장.
 * 저장본이 없으면 시드 소개(initialSummary)를 보여준다.
 */
export default function CourseSummaryBox({ courseId, initialSummary, isStaff = false }: { courseId: string; initialSummary: string; isStaff?: boolean }) {
  const [summary, setSummary] = useState(initialSummary);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/summary`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const d = (await res.json()) as { body?: string };
        if (alive && typeof d.body === "string") setSummary(d.body);
      } catch {
        /* 무시 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/summary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (res.ok) {
        const d = (await res.json()) as { body?: string };
        setSummary(typeof d.body === "string" ? d.body : draft);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold" style={{ ...serif, color: BROWN }}>강좌 소개</h2>
        {isStaff ? (
          editing ? (
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={save} disabled={saving} className="rounded-[6px] px-2 py-0.5 text-[11px] font-bold text-white disabled:opacity-60" style={{ background: BROWN }}>{saving ? "저장중" : "저장"}</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-[6px] border px-2 py-0.5 text-[11px]" style={{ borderColor: LINE, color: SUB }}>취소</button>
            </span>
          ) : (
            <button type="button" onClick={() => { setDraft(summary); setEditing(true); }} className="shrink-0 rounded-[6px] p-1 transition hover:bg-[#f1ece2]" style={{ color: BROWN }} aria-label="강좌 소개 수정" title="수정"><Pencil size={13} /></button>
          )
        ) : null}
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className="mt-2 w-full resize-y rounded-[8px] border px-2.5 py-2 text-[12.5px] leading-5 outline-none focus:border-[#8C6E59]"
          style={{ borderColor: "#E7E2D6", color: BODY }}
        />
      ) : (
        <p className="mt-2 whitespace-pre-line text-[12.5px] leading-5" style={{ color: SUB }}>{summary}</p>
      )}
    </div>
  );
}
