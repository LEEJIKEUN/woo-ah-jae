"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    setWarning(null);
    setResetUrl(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string; warning?: string; resetUrl?: string };

      if (!res.ok) {
        setError(data.error ?? "요청 처리에 실패했습니다.");
        return;
      }

      setMessage(data.message ?? "요청이 완료되었습니다.");
      setWarning(data.warning ?? null);
      setResetUrl(data.resetUrl ?? null);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-bold text-slate-100">비밀번호 찾기</h1>
      <p className="mb-6 text-sm text-slate-400">가입한 이메일을 입력하면 비밀번호 재설정 링크를 발급합니다.</p>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-[color:var(--surface)] p-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-200">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2"
            placeholder="you@example.com"
            required
          />
        </label>

        {message ? <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}
        {warning ? <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{warning}</p> : null}
        {resetUrl ? (
          <p className="rounded-md bg-slate-800/70 px-3 py-2 text-xs text-slate-300">
            개발용 재설정 링크:{" "}
            <a href={resetUrl} className="text-cyan-300 underline underline-offset-2">
              {resetUrl}
            </a>
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 disabled:opacity-60"
        >
          {loading ? "요청 중..." : "재설정 링크 받기"}
        </button>
      </form>

      <Link href="/login" className="mt-4 text-sm text-slate-300 underline underline-offset-4">
        로그인으로 돌아가기
      </Link>
    </main>
  );
}
