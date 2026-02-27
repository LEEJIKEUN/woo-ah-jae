"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = useMemo(() => params?.get("token") ?? "", [params]);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!token) {
      setError("재설정 토큰이 없습니다. 비밀번호 찾기부터 다시 진행해 주세요.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "비밀번호 재설정에 실패했습니다.");
        return;
      }

      setMessage("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.");
      setPassword("");
      setPasswordConfirm("");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-[color:var(--surface)] p-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-200">새 비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2"
            minLength={8}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-200">새 비밀번호 확인</span>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2"
            minLength={8}
            required
          />
        </label>

        {message ? <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 disabled:opacity-60"
        >
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>

      <Link href="/login" className="mt-4 text-sm text-slate-300 underline underline-offset-4">
        로그인으로 이동
      </Link>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-bold text-slate-100">새 비밀번호 설정</h1>
      <p className="mb-6 text-sm text-slate-400">새 비밀번호를 입력해 계정을 복구하세요.</p>
      <Suspense fallback={<p className="rounded-md bg-[color:var(--surface)] p-4 text-sm text-slate-300">로딩 중...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
