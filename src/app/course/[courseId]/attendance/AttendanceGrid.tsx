"use client";

import { Fragment, useState } from "react";
import { Check, UserMinus } from "lucide-react";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";

type SessionItem = { id: string; no: number | null; title: string; week: string; scheduleLabel: string | null };
type Student = { id: string; name: string };

function cellKey(userId: string, activityId: string) {
  return `${userId}:${activityId}`;
}

export default function AttendanceGrid({
  courseId,
  sessions,
  students: initialStudents,
  initialDone,
  isAdmin = false,
}: {
  courseId: string;
  sessions: SessionItem[];
  students: Student[];
  initialDone: string[];
  isAdmin?: boolean;
}) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<string | null>(null);

  async function unenroll(studentId: string, name: string) {
    if (!confirm(`'${name}' 학생의 수강신청을 취소할까요?\n\n· 강좌 로스터·강의실 접근에서 제외됩니다(정원 1명 복원).\n· 출석·이수·게시글·시험 등 기존 기록은 그대로 남습니다.\n\n되돌릴 수 없습니다.`)) return;
    setRemoving(studentId);
    try {
      const res = await fetch(`/api/courses/${courseId}/members/${studentId}`, { method: "DELETE" });
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        alert(d.error ?? "수강 취소에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setRemoving(null);
    }
  }

  async function toggle(userId: string, activityId: string) {
    const key = cellKey(userId, activityId);
    const present = !done.has(key);
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
    return <p className="mt-6 text-[14px]" style={{ color: SUB }}>아직 수강생이 없습니다. 학생이 수강신청하면 출석부에 표시됩니다.</p>;
  }

  const total = sessions.length;
  const countFor = (studentId: string) => sessions.reduce((acc, s) => acc + (done.has(cellKey(studentId, s.id)) ? 1 : 0), 0);
  let prevWeek = "";

  return (
    <div className="mt-6 overflow-x-auto rounded-[8px] border" style={{ borderColor: LINE }}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr style={{ background: "#FAF7EF" }}>
            <th className="sticky left-0 z-10 min-w-[240px] border-b px-3 py-2.5 text-left font-bold" style={{ borderColor: LINE, color: INK, background: "#FAF7EF" }}>
              회차 · 세션
            </th>
            {students.map((s) => (
              <th key={s.id} className="border-b px-3 py-2 text-center font-bold" style={{ borderColor: LINE, color: INK, minWidth: 92 }}>
                <div className="flex flex-col items-center gap-0.5">
                  <span>{s.name}</span>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => unenroll(s.id, s.name)}
                      disabled={removing === s.id}
                      title="수강 취소"
                      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium transition hover:bg-[#F7ECEC] hover:text-[#B4544B] disabled:opacity-50"
                      style={{ color: "#B49A86" }}
                    >
                      <UserMinus size={11} /> {removing === s.id ? "취소 중…" : "수강 취소"}
                    </button>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((sess) => {
            const weekHeader = sess.week !== prevWeek ? sess.week : null;
            prevWeek = sess.week;
            return (
              <Fragment key={sess.id}>
                {weekHeader ? (
                  <tr>
                    <td colSpan={students.length + 1} className="px-3 py-1.5 text-[12px] font-bold" style={{ background: "#F3EEE4", color: DEEP }}>
                      {weekHeader}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td className="sticky left-0 z-10 border-b px-3 py-2.5" style={{ borderColor: "#F0EBE0", background: "#fff" }}>
                    <span className="flex items-center gap-1.5">
                      {sess.no ? <span className="rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: BROWN }}>{sess.no}회</span> : null}
                      {sess.scheduleLabel ? <span className="text-[11px]" style={{ color: BROWN }}>{sess.scheduleLabel}</span> : null}
                    </span>
                    <span className="mt-0.5 block font-medium" style={{ color: INK }}>{sess.title}</span>
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
                          aria-label={`${s.name} · ${sess.title} 출석`}
                          className="inline-grid h-7 w-7 place-items-center rounded-[6px] border transition disabled:opacity-50"
                          style={{ borderColor: checked ? BROWN : "#D8D2C6", background: checked ? BROWN : "#fff" }}
                        >
                          {checked ? <Check size={15} strokeWidth={3} color="#fff" /> : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}

          {/* 학생별 출석 합계 */}
          <tr style={{ background: "#FAF7EF" }}>
            <td className="sticky left-0 z-10 px-3 py-3 font-bold" style={{ color: INK, background: "#FAF7EF" }}>출석 합계</td>
            {students.map((s) => {
              const c = countFor(s.id);
              return (
                <td key={s.id} className="px-3 py-3 text-center font-bold" style={{ color: DEEP }}>
                  {c} <span className="font-normal" style={{ color: SUB }}>/ {total}</span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
