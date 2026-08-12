"use client";

import { useEffect, useState } from "react";

type LinkRequest = { id: string; parentName: string | null; parentEmail: string; createdAt: string };

/**
 * 학생(자녀)에게 온 학부모 연결(열람 동의) 요청 배너.
 * 로그인한 학생에게 사이트 상단에 노출되며, 요청이 없으면 아무것도 렌더링하지 않는다.
 * '동의'를 누르면 즉시 APPROVED 되어 보호자가 학습 현황·멘토링을 열람할 수 있다.
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
        setMsg(
          action === "approve"
            ? "보호자 연결에 동의했습니다. 이제 보호자가 학습 현황과 탐구활동 멘토링을 열람할 수 있습니다."
            : "연결 요청을 거절했습니다."
        );
      }
    } finally {
      setBusy(null);
    }
  }

  if (reqs.length === 0 && !msg) return null;

  return (
    <div className="w-full border-b" style={{ background: "#FEF7E7", borderColor: "#F0E4C0" }}>
      <div className="mx-auto max-w-5xl px-4 py-3.5 md:px-6">
        <p className="text-[13px] font-bold" style={{ color: "#8a5a12" }}>보호자(학부모) 연결 동의 요청</p>
        {msg ? <p className="mt-1 text-[13px]" style={{ color: "#8a5a12" }}>{msg}</p> : null}
        {reqs.length > 0 ? (
          <ul className="mt-2 space-y-2.5">
            {reqs.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3"
                style={{ borderColor: "#F0E4C0" }}
              >
                <span className="min-w-0 flex-1 text-[13.5px] leading-6 text-slate-700">
                  <b className="text-slate-900">{r.parentName ?? "학부모"}</b>
                  <span className="text-slate-500"> ({r.parentEmail})</span> 님이 회원님의{" "}
                  <b>보호자(학부모)</b>임을 확인하고, 회원님의 <b>강의 학습 현황</b>과{" "}
                  <b>탐구활동 멘토링 현황</b>을 열람하는 것에 대한 동의를 요청했습니다.
                  <br />
                  본인의 보호자가 맞다면 <b>동의</b>를 눌러 주세요. 동의하면 보호자가 바로 열람할 수 있으며,
                  언제든 관리자에게 요청해 해지할 수 있습니다.
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => act(r.id, "approve")}
                    disabled={busy === r.id}
                    className="rounded-md px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
                    style={{ background: "#4E6B5A" }}
                  >
                    동의
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.id, "reject")}
                    disabled={busy === r.id}
                    className="rounded-md border px-4 py-2 text-[13.5px] font-semibold text-slate-600 disabled:opacity-60"
                    style={{ borderColor: "#D8D2C6" }}
                  >
                    동의 안 함
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
