"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Student = { id: string; name: string };
type Session = { activityId: string; title: string; module: string; durationSec: number };
type Cell = { watchedSec: number; totalSec: number };
type Roster = { students: Student[]; sessions: Session[]; cells: Record<string, Record<string, Cell>> };

/** 초 → "40:12" (1시간 이상이면 "1:21:07") */
function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}
function pctOf(c: Cell): number {
  if (!c.totalSec) return 0;
  return Math.min(100, Math.round((c.watchedSec / c.totalSec) * 100));
}
function pctColor(pct: number): string {
  if (pct >= 90) return "#3E7E5B";
  if (pct >= 50) return "#B06B2E";
  if (pct > 0) return "#8C6E59";
  return "#B0A89A";
}

function WatchCell({ c }: { c: Cell | undefined }) {
  if (!c) return <span className="text-[13px]" style={{ color: "#C9C2B4" }}>–</span>;
  if (!c.watchedSec && !c.totalSec) return <span className="text-[12.5px]" style={{ color: SUB }}>미시청</span>;
  const pct = pctOf(c);
  return (
    <div className="flex flex-col items-center gap-0.5 leading-none">
      <span className="text-[14px] font-extrabold tabular-nums" style={{ color: pctColor(pct) }}>{pct}%</span>
      <span className="text-[10.5px] tabular-nums" style={{ color: SUB }}>{clock(c.watchedSec)}{c.totalSec ? ` / ${clock(c.totalSec)}` : ""}</span>
    </div>
  );
}

export default function WatchProgressView({ courseId }: { courseId: string }) {
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/watch/roster`, { cache: "no-store" });
      const d = (await res.json()) as Roster & { error?: string };
      if (!res.ok) { setError(d.error ?? "불러오지 못했습니다."); return; }
      setError(null);
      setData(d);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);
  // 실시간 갱신 — 학생 시청 보고(≈10초)에 맞춰 12초마다 폴링
  useEffect(() => {
    const t = setInterval(() => void load(), 12000);
    return () => clearInterval(t);
  }, [load]);

  // 학생별 평균 시청률(동영상 차시 기준)
  const avgFor = (studentId: string): number | null => {
    if (!data || !data.sessions.length) return null;
    const ps = data.sessions.map((s) => pctOf(data.cells[studentId]?.[s.activityId] ?? { watchedSec: 0, totalSec: s.durationSec }));
    return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length);
  };

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff />
      <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-[1100px]">
          <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>← 강의실</Link>
          <h1 className="text-[24px] font-normal md:text-[28px]" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>강의 수강 현황</h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: SUB }}>동영상이 있는 차시별로 학생의 시청 진도(시청 시간 / 총 길이)를 실시간으로 보여줍니다. 12초마다 자동 갱신됩니다.</p>

          {error ? (
            <p className="py-16 text-center text-[14px]" style={{ color: "#a6402c" }}>{error}</p>
          ) : !data ? (
            <p className="py-16 text-center text-[14px]" style={{ color: SUB }}>불러오는 중…</p>
          ) : data.sessions.length === 0 ? (
            <div className="mt-6 rounded-[14px] border py-16 text-center" style={{ borderColor: LINE, background: PANEL }}>
              <p className="text-[15px]" style={{ color: SUB }}>동영상이 등록된 차시가 없습니다. 차시 학습 콘텐츠에 동영상을 업로드하면 여기에 표시됩니다.</p>
            </div>
          ) : data.students.length === 0 ? (
            <div className="mt-6 rounded-[14px] border py-16 text-center" style={{ borderColor: LINE, background: PANEL }}>
              <p className="text-[15px]" style={{ color: SUB }}>수강생이 없습니다.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-[14px] border" style={{ borderColor: LINE }}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr style={{ background: PANEL }}>
                    <th className="sticky left-0 z-10 min-w-[120px] border-b px-4 py-3 text-[13px] font-bold" style={{ borderColor: LINE, color: INK, background: PANEL }}>수강생</th>
                    {data.sessions.map((s) => (
                      <th key={s.activityId} className="border-b border-l px-3 py-2.5 text-center text-[12px] font-bold" style={{ borderColor: LINE, color: INK, minWidth: 120 }}>
                        <span className="block truncate" title={`${s.module} · ${s.title}`}>{s.title}</span>
                        <span className="text-[10.5px] font-medium" style={{ color: SUB }}>{s.durationSec ? clock(s.durationSec) : "길이 미상"}</span>
                      </th>
                    ))}
                    <th className="border-b border-l px-3 py-2.5 text-center text-[12.5px] font-bold" style={{ borderColor: LINE, color: INK, minWidth: 84, background: "#F3EDE0" }}>평균</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => {
                    const avg = avgFor(s.id);
                    return (
                      <tr key={s.id}>
                        <td className="sticky left-0 z-10 border-b px-4 py-2.5 text-[13.5px] font-semibold" style={{ borderColor: "#F0EBE0", color: INK, background: "#fff" }}>{s.name}</td>
                        {data.sessions.map((sess) => (
                          <td key={sess.activityId} className="border-b border-l px-3 py-2.5 text-center" style={{ borderColor: "#F0EBE0" }}>
                            <WatchCell c={data.cells[s.id]?.[sess.activityId]} />
                          </td>
                        ))}
                        <td className="border-b border-l px-3 py-2.5 text-center" style={{ borderColor: "#F0EBE0", background: "#FBF8F2" }}>
                          {avg == null ? <span className="text-[12.5px]" style={{ color: "#C9C2B4" }}>–</span> : <span className="text-[14px] font-extrabold tabular-nums" style={{ color: pctColor(avg) }}>{avg}%</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[12.5px]" style={{ color: SUB }}>시청 진도는 학생이 재생한 최대 위치를 기준으로 합니다(뒤로 감아도 최대 시청 유지). 평균은 동영상 차시 전체의 시청률 평균입니다.</p>
        </div>
      </main>
    </div>
  );
}
