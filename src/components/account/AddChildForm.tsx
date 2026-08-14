"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 학부모가 자녀를 이메일 인증으로 추가(최대 4명). 코드는 자녀 이메일로 발송됨. */
export default function AddChildForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!email.trim() || !email.includes("@")) { setMsg({ ok: false, text: "자녀 이메일을 입력하세요." }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/me/children/send-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childEmail: email.trim() }) });
      const d = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "인증코드 발송에 실패했습니다." }); return; }
      setStage("sent");
      setMsg({ ok: true, text: d.message ?? "자녀 이메일로 인증코드를 보냈습니다." });
    } catch { setMsg({ ok: false, text: "네트워크 오류가 발생했습니다." }); } finally { setBusy(false); }
  }

  async function add() {
    if (!/^\d{6}$/.test(code.trim())) { setMsg({ ok: false, text: "6자리 인증코드를 입력하세요." }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/me/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childEmail: email.trim(), code: code.trim() }) });
      const d = (await res.json()) as { ok?: boolean; childName?: string; error?: string };
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "자녀 연결에 실패했습니다." }); return; }
      setMsg({ ok: true, text: `${d.childName ?? "자녀"} 님이 연결되었습니다.` });
      setEmail(""); setCode(""); setStage("idle");
      router.refresh();
    } catch { setMsg({ ok: false, text: "네트워크 오류가 발생했습니다." }); } finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-md border border-slate-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#8C6E59]";
  const btn = "shrink-0 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";

  return (
    <div className="mt-2 rounded-md border border-dashed border-slate-300 p-3">
      <p className="text-sm font-semibold text-slate-700">자녀 추가</p>
      <p className="mt-0.5 text-xs text-slate-500">자녀 이메일로 인증코드를 보내고, 자녀가 받은 6자리 코드를 입력하면 연결됩니다. (최대 4명)</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="자녀 이메일" className={`${inputCls} min-w-[200px] flex-1`} />
        <button type="button" onClick={sendCode} disabled={busy} className={btn} style={{ background: "#6B5342" }}>{stage === "sent" ? "재발송" : "인증코드 발송"}</button>
      </div>
      {stage === "sent" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6자리 코드" className={`${inputCls} w-32`} />
          <button type="button" onClick={add} disabled={busy} className={btn} style={{ background: "#8C6E59" }}>연결</button>
        </div>
      ) : null}
      {msg ? <p className="mt-2 text-xs" style={{ color: msg.ok ? "#3E7E5B" : "#a6402c" }}>{msg.text}</p> : null}
    </div>
  );
}
