"use client";

import { useState } from "react";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";

export default function ConsentForm({
  token,
  parentName,
  parentEmail,
  childName,
}: {
  token: string;
  parentName: string;
  parentEmail: string;
  childName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parent-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "처리에 실패했습니다.");
        return;
      }
      setDone(action);
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[12px] border p-6 text-center" style={{ borderColor: "#E4DBC7" }}>
        <p className="text-[16px] font-bold" style={{ color: INK }}>
          {done === "approve" ? "동의가 완료되었습니다." : "요청을 거절했습니다."}
        </p>
        <p className="mt-2 text-[14px] leading-6" style={{ color: SUB }}>
          {done === "approve"
            ? `${parentName} 님이 이제 회원님의 강의 학습 현황과 탐구활동 멘토링 현황을 열람할 수 있습니다. 동의 해지는 언제든 관리자에게 요청할 수 있습니다.`
            : "보호자에게 열람 권한이 부여되지 않았습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border p-6" style={{ borderColor: "#E4DBC7", background: "#fff" }}>
      <p className="text-[15px] leading-7" style={{ color: INK }}>
        <b>{childName}</b> 님,
        <br />
        <b>{parentName}</b> <span style={{ color: SUB }}>({parentEmail})</span> 님이 회원님의 <b>보호자(학부모)</b>임을 확인하고,
        회원님의 <b>강의 학습 현황</b>과 <b>탐구활동 멘토링 현황</b>을 열람하는 것에 대한 동의를 요청했습니다.
      </p>
      <p className="mt-3 text-[13.5px] leading-6" style={{ color: SUB }}>
        본인의 보호자가 맞다면 <b>동의</b>를 눌러 주세요. 동의하면 보호자가 바로 열람할 수 있으며,
        언제든 관리자에게 요청해 해지할 수 있습니다. 본인이 모르는 요청이라면 <b>동의 안 함</b>을 눌러 주세요.
      </p>

      {error ? <p className="mt-3 text-[13px]" style={{ color: "#a6402c" }}>{error}</p> : null}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={busy}
          className="flex-1 rounded-[8px] px-5 py-3 text-[15px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "#4E6B5A" }}
        >
          {busy ? "처리 중..." : "동의"}
        </button>
        <button
          type="button"
          onClick={() => act("reject")}
          disabled={busy}
          className="rounded-[8px] border px-5 py-3 text-[15px] font-semibold transition hover:opacity-90 disabled:opacity-60"
          style={{ borderColor: "#D8D2C6", color: SUB }}
        >
          동의 안 함
        </button>
      </div>
    </div>
  );
}
