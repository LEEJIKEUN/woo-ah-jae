"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CategoryTab, PRIMARY_TABS } from "@/lib/categoryConfig";

type HeaderSession = {
  userId: string;
  role: "ADMIN" | "STUDENT";
  email: string;
};

type Props = {
  session: HeaderSession | null;
  accountLabel?: string;
};

export default function Header({ session, accountLabel }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<CategoryTab | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!pathname?.startsWith("/category")) {
      setActiveTab(null);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && PRIMARY_TABS.includes(tab as CategoryTab)) {
      setActiveTab(tab as CategoryTab);
    } else {
      setActiveTab("교과");
    }
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const accountInitial = useMemo(() => {
    const source = session?.email?.charAt(0) || "U";
    return source.toUpperCase();
  }, [session?.email]);

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
    <header
      className={`sticky top-0 z-50 border-b transition ${
        isScrolled
          ? "border-white/10 bg-black/60 shadow-sm shadow-black/20 backdrop-blur-lg"
          : "border-white/10 bg-black/35 backdrop-blur-md"
      }`}
    >
      <nav className="mx-auto flex h-[var(--header-h)] w-full max-w-[1600px] items-center justify-between gap-8 px-6 md:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link href="/" className="shrink-0 text-base font-semibold tracking-tight text-[color:var(--foreground)]">
            Woo Ah Jae
          </Link>

          <div className="hidden min-w-0 flex-nowrap items-center gap-2 md:flex">
            {PRIMARY_TABS.map((tab) => (
              <Link
                key={tab}
                href={`/category?tab=${encodeURIComponent(tab)}&channel=전체&sort=popular`}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium transition ${
                  activeTab === tab
                    ? "bg-slate-100/10 text-slate-100"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                <span className="whitespace-nowrap">{tab}</span>
              </Link>
            ))}
            <Link
              href="/community/admissions?board=all"
              className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium text-slate-300 transition hover:text-slate-100"
            >
              학습+입시 정보 공유
            </Link>
            <Link
              href="/boards/talk"
              className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium text-slate-300 transition hover:text-slate-100"
            >
              이야기 나눠요
            </Link>
          </div>
        </div>

        {!session ? (
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/signup" className="text-slate-300 transition hover:text-white">
              회원가입
            </Link>
            <Link href="/login" className="text-slate-300 transition hover:text-white">
              로그인
            </Link>
          </div>
        ) : (
          <div className="relative ml-4 flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/me/projects" className="whitespace-nowrap rounded-md border border-slate-500/70 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-slate-300 hover:text-white">
                내 프로젝트 관리
              </Link>
              <Link href="/projects/new" className="whitespace-nowrap rounded-md border border-slate-500/70 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-slate-300 hover:text-white">
                새 프로젝트 만들기
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-sm font-semibold text-slate-100"
              aria-label="계정 메뉴"
            >
              {accountInitial}
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="max-w-[180px] truncate text-left text-xs text-slate-300 transition hover:text-slate-100 md:max-w-[260px]"
              aria-label="계정 정보"
            >
              {accountLabel ?? session.email}
            </button>

            {open ? (
              <div className="absolute right-0 top-11 z-50 w-44 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 shadow-xl shadow-black/40">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]"
                >
                  내정보
                </Link>
                {session.role === "ADMIN" ? (
                  <Link
                    href="/admin/members"
                    onClick={() => setOpen(false)}
                    className="mt-1 block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]"
                  >
                    회원 관리
                  </Link>
                ) : (
                  <Link
                    href="/me/projects"
                    onClick={() => setOpen(false)}
                    className="mt-1 block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]"
                  >
                    내 프로젝트 관리
                  </Link>
                )}
                <button
                  type="button"
                  disabled={loading}
                  onClick={logout}
                  className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
                >
                  {loading ? "로그아웃 중..." : "로그아웃"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </nav>
    </header>
  );
}
