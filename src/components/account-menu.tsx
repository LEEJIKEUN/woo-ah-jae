"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  role: "ADMIN" | "STUDENT";
  email: string;
};

export default function AccountMenu({ role, email }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const initial = useMemo(() => email.charAt(0).toUpperCase() || "U", [email]);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-sm font-semibold text-slate-100"
        aria-label="계정 메뉴"
      >
        {initial}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-lg shadow-black/40">
          <div className="px-3 py-2 text-xs text-slate-400">{email}</div>

          {role === "ADMIN" ? (
            <>
              <Link href="/account" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]">계정 정보</Link>
              <Link href="/admin/members" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]">회원 관리 (구독관리)</Link>
            </>
          ) : (
            <>
              <Link href="/account" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]">정보 수정</Link>
              <Link href="/settings/password" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]">비밀번호 변경</Link>
              <Link href="/billing" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]">구독 정보</Link>
              <Link href="/my-projects" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]">내 프로젝트 관리</Link>
              <Link href="/joined-projects" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-[color:var(--surface-elevated)]">참여중인 프로젝트</Link>
            </>
          )}

          <button
            type="button"
            onClick={logout}
            disabled={loading}
            className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
          >
            {loading ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
