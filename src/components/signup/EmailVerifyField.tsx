"use client";

import { useEffect, useRef, useState } from "react";

const inputCls =
  "w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * 회원가입 이메일 입력 + 6자리 코드 인증.
 * <input name="email"> 을 직접 렌더(readOnly 잠금이라 폼 제출값에 포함됨).
 * 인증 완료 여부를 onVerifiedChange 로 부모에 알려 제출 버튼을 제어한다.
 * initialEmail/initialVerified 로 임시저장 복원 지원.
 */
export default function EmailVerifyField({
  onVerifiedChange,
  onEmailChange,
  initialEmail = "",
  initialVerified = false,
}: {
  onVerifiedChange?: (verified: boolean) => void;
  onEmailChange?: (email: string) => void;
  initialEmail?: string;
  initialVerified?: boolean;
}) {
  const [email, setEmailState] = useState(initialEmail);
  const setEmail = (v: string) => { setEmailState(v); onEmailChange?.(v); };
  const [phase, setPhase] = useState<"idle" | "sent" | "verified">(initialVerified ? "verified" : "idle");
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (initialVerified) onVerifiedChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sendCode() {
    setErr(null);
    setMsg(null);
    const e = email.trim();
    if (!EMAIL_RE.test(e)) {
      setErr("올바른 이메일을 입력해 주세요.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/email-code/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const data = (await res.json()) as { message?: string; error?: string; devCode?: string };
      if (!res.ok) {
        setErr(data.error ?? "인증코드 발송에 실패했습니다.");
        return;
      }
      setPhase("sent");
      setMsg(data.devCode ? `인증코드를 보냈습니다. (개발용 코드: ${data.devCode})` : data.message ?? "인증코드를 보냈습니다.");
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    setErr(null);
    setMsg(null);
    if (!/^\d{6}$/.test(code)) {
      setErr("6자리 숫자 코드를 입력해 주세요.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/email-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "인증에 실패했습니다.");
        return;
      }
      setPhase("verified");
      setMsg("이메일 인증이 완료되었습니다.");
      onVerifiedChange?.(true);
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setVerifying(false);
    }
  }

  function editEmail() {
    setPhase("idle");
    setCode("");
    setMsg(null);
    setErr(null);
    onVerifiedChange?.(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          value={email}
          readOnly={phase !== "idle"}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`${inputCls} ${phase !== "idle" ? "bg-slate-100 text-slate-500" : ""}`}
        />
        {phase === "verified" ? (
          <span className="inline-flex shrink-0 items-center rounded-md px-3 text-sm font-semibold text-emerald-600">
            ✓ 인증완료
          </span>
        ) : (
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="shrink-0 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {sending ? "발송 중…" : phase === "sent" ? "재발송" : "인증코드 발송"}
          </button>
        )}
      </div>

      {phase === "sent" ? (
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6자리 인증코드"
            className={`${inputCls} tracking-[0.4em]`}
          />
          <button
            type="button"
            onClick={verify}
            disabled={verifying}
            className="shrink-0 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#4E6B5A" }}
          >
            {verifying ? "확인 중…" : "확인"}
          </button>
        </div>
      ) : null}

      {phase === "verified" ? (
        <button type="button" onClick={editEmail} className="text-xs text-slate-500 underline">
          이메일 변경
        </button>
      ) : null}

      {msg ? <p className="text-xs text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-xs text-rose-600">{err}</p> : null}
    </div>
  );
}
