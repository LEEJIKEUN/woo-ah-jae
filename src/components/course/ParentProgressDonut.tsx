"use client";

import { useEffect, useState } from "react";

/**
 * 학부모 사이드바용 '연결된 자녀' 진도율 도넛.
 * 자녀 로그인 화면의 진도율과 동일한 계산을 서버에서 받아 표시한다.
 */
export default function ParentProgressDonut({ courseId }: { courseId: string }) {
  const [percent, setPercent] = useState<number | null>(null);
  const [childName, setChildName] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/child-progress`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const d = (await res.json()) as { percent?: number | null; childName?: string | null };
        if (!alive) return;
        if (typeof d.percent === "number") setPercent(d.percent);
        if (d.childName) setChildName(d.childName);
      } catch {
        /* 무시 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  const p = percent ?? 0;
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c * (1 - p / 100);
  return (
    <svg width={44} height={44} viewBox="0 0 48 48" className="shrink-0" role="img" aria-label={childName ? `${childName} 진도율 ${p}%` : "자녀 진도율"}>
      <title>{childName ? `${childName} 자녀 진도율` : "자녀 진도율"}</title>
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 24 24)" />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" style={{ fill: "#fff", fontSize: 12, fontWeight: 700 }}>
        {percent === null ? "…" : `${p}%`}
      </text>
    </svg>
  );
}
