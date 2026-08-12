"use client";

import { useEffect, useState } from "react";

type LinkRequest = { id: string; parentName: string | null; parentEmail: string; createdAt: string };

/**
 * 학생(자녀) 계정에 온 학부모 연결 요청 카드. 요청이 없으면 아무것도 렌더링하지 않는다.
 * 계정 페이지 상단에 배치되어 수락/거절할 수 있다.
 */
export default function ParentLinkRequests() {
  const [reqs, setReqs] = useState<LinkRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/me/parent-links", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { requests?: LinkRequest[] };
        if (alive && Array.isArray(data.requests)) setReqs(data.requests);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch("/api/me/parent-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: id, action }),
      });
      if (res.ok) {
        setReqs((prev) => prev.filter((r) => r.id !== id));
        setMsg(action === "approve" ? "학부모 연결을 수락했습니다." : "연결 요청을 거절했습니다.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (reqs.length === 0 && !msg) return null;

  return (
    <section className="rounded-xl border border-amber-300/60 bg-amber-50 p-5">
      <h2 className="text-lg font-semibold text-amber-900">학부모 연결 요청</h2>
      {msg ? <p className="mt-1 text-sm text-amber-800">{msg}</p> : null}
      {reqs.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {reqs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-4 py-3">
              <span className="text-sm text-slate-700">
                <b className="text-slate-900">{r.parentName ?? "학부모"}</b> ({r.parentEmail}) 님이 진도 열람 연결을 요청했습니다.
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => act(r.id, "approve")}
                  disabled={busy === r.id}
                  className="rounded-md px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: "#4E6B5A" }}
                >
                  수락
                </button>
                <button
                  type="button"
                  onClick={() => act(r.id, "reject")}
                  disabled={busy === r.id}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"
                >
                  거절
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
