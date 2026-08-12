"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/nav/Logo";

type HeaderSession = {
  userId: string;
  role: "ADMIN" | "FACILITATOR" | "PARENT" | "STUDENT";
  email: string;
};

type Props = {
  session: HeaderSession | null;
  accountLabel?: string;
};

const BROWN = "#8c6e59";
const SUB = "#8a8479";
const LINE = "#ece7df";
const MENU = "#363636";
const serif = { fontFamily: "var(--font-serif)" } as const;

const SLOGANS = ["천천히, 깊게, 제대로.", "배움이 머무는 곳.", "공부가 습관이 되는 공간.", "온라인에 세운 새로운 서재."];

export default function Header({ session, accountLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const t = setInterval(() => setS((i) => (i + 1) % SLOGANS.length), 3200);
    return () => clearInterval(t);
  }, []);

  const accountInitial = useMemo(() => (session?.email?.charAt(0) || "U").toUpperCase(), [session?.email]);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur">
      <nav className="flex h-[68px] w-full items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          {/* 엠블럼 + 영문 워드마크 */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Logo size={30} withText={false} />
            <span className="text-[13px] font-semibold uppercase" style={{ letterSpacing: "0.22em", color: BROWN }}>
              WOO AH JAE
            </span>
          </Link>
          {/* 페이드 회전 슬로건 */}
          <span className="hidden min-w-0 truncate pl-3 text-[15px] md:inline-block" style={serif}>
            <span style={{ color: BROWN }}>우아재, </span>
            <span key={s} className="inline-block" style={{ color: BROWN, animation: "wjfade 0.7s ease" }}>
              {SLOGANS[s]}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!session ? (
            <div className="flex items-center gap-4 text-[14px]">
              <Link href="/login" className="transition hover:opacity-70" style={{ color: SUB, ...serif }}>로그인</Link>
              <Link href="/signup" className="inline-flex h-9 items-center rounded-[6px] px-5 text-white transition hover:opacity-90" style={{ background: BROWN, ...serif }}>회원가입</Link>
            </div>
          ) : (
            <div className="relative flex items-center gap-2">
              <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ background: BROWN }} aria-label="계정 메뉴">
                {accountInitial}
              </button>
              <button type="button" onClick={() => setOpen((v) => !v)} className="hidden max-w-[120px] truncate text-[13px] md:block" style={{ color: SUB }} title={accountLabel ?? session.email}>
                {accountLabel ?? session.email}
              </button>
              {open ? (
                <div className="absolute right-0 top-11 z-50 w-44 rounded-[4px] border bg-white p-1.5 shadow-lg" style={{ borderColor: LINE }}>
                  <Link href="/account" onClick={() => setOpen(false)} className="block rounded-[2px] px-3 py-2 text-[14px] hover:bg-[#f6f3ef]" style={{ color: MENU }}>내정보</Link>
                  {session.role === "ADMIN" ? (
                    <>
                      <Link href="/my-courses" onClick={() => setOpen(false)} className="mt-0.5 block rounded-[2px] px-3 py-2 text-[14px] font-semibold hover:bg-[#f6f3ef]" style={{ color: BROWN }}>강좌 관리</Link>
                      <Link href="/admin/members" onClick={() => setOpen(false)} className="mt-0.5 block rounded-[2px] px-3 py-2 text-[14px] hover:bg-[#f6f3ef]" style={{ color: MENU }}>회원 관리</Link>
                    </>
                  ) : session.role === "PARENT" ? (
                    <>
                      <Link href="/me/children" onClick={() => setOpen(false)} className="mt-0.5 block rounded-[2px] px-3 py-2 text-[14px] font-semibold hover:bg-[#f6f3ef]" style={{ color: BROWN }}>자녀 학습 현황</Link>
                      <Link href="/my-courses" onClick={() => setOpen(false)} className="mt-0.5 block rounded-[2px] px-3 py-2 text-[14px] hover:bg-[#f6f3ef]" style={{ color: MENU }}>내 강의실</Link>
                    </>
                  ) : (
                    <Link href="/my-courses" onClick={() => setOpen(false)} className="mt-0.5 block rounded-[2px] px-3 py-2 text-[14px] font-semibold hover:bg-[#f6f3ef]" style={{ color: BROWN }}>내 강의실</Link>
                  )}
                  <button type="button" disabled={loading} onClick={logout} className="mt-0.5 block w-full rounded-[2px] px-3 py-2 text-left text-[14px] hover:bg-[#f6f3ef] disabled:opacity-60" style={{ color: "#a6402c" }}>
                    {loading ? "나가는 중..." : "나가기"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
