"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";

type SessionItem = { id: string; title: string; moduleLabel: string; scheduleLabel?: string };
type Student = { id: string; name: string };

function cellKey(userId: string, activityId: string) {
  return `${userId}:${activityId}`;
}

export default function AttendanceGrid({
  courseId,
  sessions,
  students,
  initialDone,
}: {
  courseId: string;
  sessions: SessionItem[];
  students: Student[];
  initialDone: string[];
}) {
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function toggle(userId: string, activityId: string) {
    const key = cellKey(userId, activityId);
    const present = !done.has(key);
    // 낙관적 갱신
    setDone((prev) => {
      const next = new Set(prev);
      if (present) next.add(key);
      else next.delete(key);
      return next;
    });
    setBusy((prev) => new Set(prev).add(key));
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, activityId, present }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // 실패 → 롤백
      setDone((prev) => {
        const next = new Set(prev);
        if (present) next.delete(key);
        else next.add(key);
        return next;
      });
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (students.length === 0) {
    return <p className="mt-6 text-[14px]" style={{ color: SUB }}>아직 수강생이 없습니다.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-[8px] border" style={{ borderColor: LINE }}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr style={{ background: "#FAF7EF" }}>
            <th className="sticky left-0 z-10 min-w-[220px] border-b px-3 py-2.5 text-left font-bold" style={{ borderColor: LINE, color: INK, background: "#FAF7EF" }}>
              세션
            </th>
            {students.map((s) => (
              <th key={s.id} className="border-b px-3 py-2.5 text-center font-bold" style={{ borderColor: LINE, color: INK, minWidth: 96 }}>
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((sess) => (
            <tr key={sess.id}>
              <td className="sticky left-0 z-10 border-b px-3 py-2.5" style={{ borderColor: "#F0EBE0", background: "#fff" }}>
                <span className="block text-[11px]" style={{ color: BROWN }}>{sess.moduleLabel}{sess.scheduleLabel ? ` · ${sess.scheduleLabel}` : ""}</span>
                <span className="block font-medium" style={{ color: INK }}>{sess.title}</span>
              </td>
              {students.map((s) => {
                const key = cellKey(s.id, sess.id);
                const checked = done.has(key);
                const isBusy = busy.has(key);
                return (
                  <td key={s.id} className="border-b px-3 py-2.5 text-center" style={{ borderColor: "#F0EBE0" }}>
                    <button
                      type="button"
                      onClick={() => toggle(s.id, sess.id)}
                      disabled={isBusy}
                      aria-label={`${s.name} 출석`}
                      className="inline-grid h-7 w-7 place-items-center rounded-[6px] border transition disabled:opacity-50"
                      style={{
                        borderColor: checked ? BROWN : "#D8D2C6",
                        background: checked ? BROWN : "#fff",
                      }}
                    >
                      {checked ? <Check size={15} strokeWidth={3} color="#fff" /> : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
