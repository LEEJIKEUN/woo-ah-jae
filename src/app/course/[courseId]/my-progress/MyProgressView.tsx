"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Session = { activityId: string; title: string; module: string; watchedSec: number; totalSec: number };
type Data = { courseTitle: string; sessions: Session[] };

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}
const pctOf = (s: Session) => (s.totalSec ? Math.min(100, Math.round((s.watchedSec / s.totalSec) * 100)) : 0);
function pctColor(pct: number): string {
  if (pct >= 90) return "#3E7E5B";
  if (pct >= 50) return "#B06B2E";
  if (pct > 0) return BROWN;
  return "#B0A89A";
}

export default function MyProgressView({ courseId }: { courseId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/watch/me`, { cache: "no-store" });
      const d = (await res.json()) as Data & { error?: string };
      if (!res.ok) { setError(d.error ?? "불러오지 못했습니다."); return; }
      setError(null);
      setData(d);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => void load(), 4000); return () => clearInterval(t); }, [load]);

  const done = data ? data.sessions.filter((s) => pctOf(s) >= 90).length : 0;
  const total = data ? data.sessions.length : 0;
  const overall = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} />
      <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-[760px]">
          <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>← 강의실</Link>
          <h1 className="text-[24px] font-normal md:text-[28px]" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>내 수강 현황</h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: SUB }}>동영상 강의별 내 시청 진도입니다. 실제로 재생한 구간만 집계됩니다.</p>

          {error ? (
            <p className="py-16 text-center text-[14px]" style={{ color: "#a6402c" }}>{error}</p>
          ) : !data ? (
            <p className="py-16 text-center text-[14px]" style={{ color: SUB }}>불러오는 중…</p>
          ) : data.sessions.length === 0 ? (
            <div className="mt-6 rounded-[14px] border py-16 text-center" style={{ borderColor: LINE, background: PANEL }}>
              <p className="text-[15px]" style={{ color: SUB }}>아직 동영상 강의가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 전체 요약 */}
              <div className="mt-5 flex items-center gap-4 rounded-[14px] border p-5" style={{ borderColor: LINE, background: PANEL }}>
                <div className="flex flex-col">
                  <span className="text-[12.5px]" style={{ color: SUB }}>수강 진도율 (완강 기준)</span>
                  <span className="text-[26px] font-extrabold tabular-nums" style={{ color: pctColor(overall) }}>{overall}%</span>
                </div>
                <div className="ml-auto text-right">
                  <span className="text-[13px]" style={{ color: SUB }}>완강 </span>
                  <span className="text-[15px] font-bold" style={{ color: DEEP }}>{done}/{total}강</span>
                </div>
              </div>

              {/* 강의별 진도 */}
              <ul className="mt-5 space-y-2.5">
                {data.sessions.map((s, i) => {
                  const pct = pctOf(s);
                  return (
                    <li key={s.activityId} className="rounded-[12px] border p-4" style={{ borderColor: LINE }}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: PANEL, color: BROWN }}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold" style={{ color: INK }} title={s.title}>{s.title}</p>
                          <p className="mt-0.5 text-[12px]" style={{ color: SUB }}>{s.module}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-[16px] font-extrabold tabular-nums" style={{ color: pctColor(pct) }}>{pct}%</span>
                          <p className="text-[11.5px] tabular-nums" style={{ color: SUB }}>{clock(s.watchedSec)}{s.totalSec ? ` / ${clock(s.totalSec)}` : ""}</p>
                        </div>
                        <Link href={`/course/${courseId}/a/${s.activityId}`} title="이어보기" className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:bg-[#F1EADD]" style={{ color: BROWN }}><PlayCircle size={20} /></Link>
                      </div>
                      {/* 진행 바 */}
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "#EFEADF" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pctColor(pct) }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
