"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [nextPath, setNextPath] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/");
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-bold text-slate-100">로그인</h1>
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
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-200">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2"
            placeholder="********"
            required
          />
        </label>
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-slate-300 hover:text-slate-100">
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}
