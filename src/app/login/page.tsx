"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BROWN = "#8C6E59";
const INK = "#2A2C2F";

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
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[400px] flex-col justify-center px-6 py-16">
      <div className="rounded-[8px] border border-[#e9ebee] bg-white p-7">
        <h1 className="mb-6 text-[22px] font-bold" style={{ color: INK }}>로그인</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-bold" style={{ color: INK }}>이메일</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[4px] border border-[#e0e2e6] px-3 py-2.5 text-[14px] outline-none focus:border-[#8C6E59]"
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-bold" style={{ color: INK }}>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[4px] border border-[#e0e2e6] px-3 py-2.5 text-[14px] outline-none focus:border-[#8C6E59]"
              placeholder="••••••••"
              required
            />
          </label>
          <div className="text-right">
            <Link href="/forgot-password" className="text-[12px]" style={{ color: "#999" }}>
              비밀번호를 잊으셨나요?
            </Link>
          </div>

          {error ? (
            <p className="rounded-[4px] bg-rose-50 px-3 py-2 text-[13px] text-rose-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[4px] py-2.5 text-[15px] font-bold text-white disabled:opacity-60"
            style={{ background: BROWN }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-[13px]" style={{ color: "#666" }}>
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-bold" style={{ color: BROWN }}>회원가입</Link>
      </p>
    </main>
  );
}
