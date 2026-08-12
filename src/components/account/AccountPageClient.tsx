"use client";

import { useState } from "react";

type MeResponse = {
  id: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  createdAt: string;
  studentProfile: {
    realName: string;
    schoolName: string;
    grade: string;
    className: string | null;
    number: string | null;
    bio: string | null;
  } | null;
};

type Props = {
  initialMe: MeResponse;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("ko-KR", { hour12: false });
}

export default function AccountPageClient({ initialMe }: Props) {
  const [me, setMe] = useState(initialMe);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    realName: initialMe.studentProfile?.realName ?? "",
    schoolName: initialMe.studentProfile?.schoolName ?? "",
    grade: initialMe.studentProfile?.grade ?? "",
    className: initialMe.studentProfile?.className ?? "",
    number: initialMe.studentProfile?.number ?? "",
    bio: initialMe.studentProfile?.bio ?? "",
  });

  async function refreshMe() {
    const res = await fetch("/api/me", { cache: "no-store" });
    const data = (await res.json()) as MeResponse | { error: string };
    if (!res.ok || "error" in data) {
      throw new Error("계정 정보를 다시 불러오지 못했습니다.");
    }
    setMe(data);
  }

  async function onSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "저장에 실패했습니다.");
      }
      await refreshMe();
      setMessage("프로필 정보가 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
        <div>
          <h1 className="text-3xl font-bold">계정정보</h1>
          <p className="mt-1 text-sm text-slate-500">프로필 정보를 관리할 수 있습니다.</p>
        </div>

        {message ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <section className="rounded-xl border border-slate-200/70 bg-[color:var(--surface)] p-5">
          <h2 className="text-xl font-semibold text-slate-900">프로필</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSaveProfile}>
            <label className="space-y-1">
              <span className="text-sm text-slate-600">실명 *</span>
              <input className="h-10 w-full rounded-md border border-slate-200/80 bg-transparent px-3 text-sm text-slate-900" value={form.realName} onChange={(e) => setForm((p) => ({ ...p, realName: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-600">학교 *</span>
              <input className="h-10 w-full rounded-md border border-slate-200/80 bg-transparent px-3 text-sm text-slate-900" value={form.schoolName} onChange={(e) => setForm((p) => ({ ...p, schoolName: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-600">학년 *</span>
              <input className="h-10 w-full rounded-md border border-slate-200/80 bg-transparent px-3 text-sm text-slate-900" value={form.grade} onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-600">반</span>
              <input className="h-10 w-full rounded-md border border-slate-200/80 bg-transparent px-3 text-sm text-slate-900" value={form.className} onChange={(e) => setForm((p) => ({ ...p, className: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-600">번호</span>
              <input className="h-10 w-full rounded-md border border-slate-200/80 bg-transparent px-3 text-sm text-slate-900" value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm text-slate-600">소개</span>
              <textarea className="min-h-24 w-full rounded-md border border-slate-200/80 bg-transparent px-3 py-2 text-sm text-slate-900" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} />
            </label>

            <div className="rounded-md border border-slate-200/80 bg-white/40 px-3 py-2 text-sm text-slate-600">가입일: {fmtDate(me.createdAt)}</div>
            <div className="rounded-md border border-slate-200/80 bg-white/40 px-3 py-2 text-sm text-slate-600">권한: {me.role === "ADMIN" ? "관리자" : "학생"}</div>

            <div className="md:col-span-2 flex justify-end">
              <button disabled={saving} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-60">
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
