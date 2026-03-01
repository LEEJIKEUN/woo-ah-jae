"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

type Status = "IDLE" | "SCHEDULED" | "ACTIVE";
type FetchResult = { status: Status; lockAt: string | null; messageKor: string | null };

const fetcher = (url: string) => fetch(url).then((res) => res.json() as Promise<FetchResult>);

function formatDiff(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const secs = Math.max(0, Math.floor((ms % 60000) / 1000));
  return `${mins}분 ${secs.toString().padStart(2, "0")}초`;
}

export default function MaintenanceBanner() {
  const { data } = useSWR<FetchResult>("/api/maintenance/status", fetcher, { refreshInterval: 60_000 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const notice = useMemo(() => {
    if (!data) return null;
    if (data.status === "ACTIVE") {
      return { level: "error" as const, text: data.messageKor ?? "시스템 점검 중입니다." };
    }
    if (data.status === "SCHEDULED" && data.lockAt) {
      const lockTime = new Date(data.lockAt).getTime();
      const diff = lockTime - now;
      if (diff <= 0) return { level: "error" as const, text: "잠시 후 점검이 시작됩니다." };
      if (diff <= 5 * 60_000) {
        return { level: "warn" as const, text: `시스템 점검이 5분 후 시작됩니다. (약 ${formatDiff(diff)} 남음)` };
      }
      if (diff <= 10 * 60_000) {
        return { level: "warn" as const, text: `시스템 점검이 10분 후 시작됩니다. (약 ${formatDiff(diff)} 남음)` };
      }
    }
    return null;
  }, [data, now]);

  if (!notice) return null;

  const base = notice.level === "error" ? "bg-rose-600/90" : "bg-amber-500/90";

  return (
    <div className={`${base} px-4 py-2 text-center text-sm font-medium text-white`}>{notice.text}</div>
  );
}
