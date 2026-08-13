"use client";

import { useState } from "react";

type MeResponse = {
  id: string;
  email: string;
  role: "STUDENT" | "FACILITATOR" | "PARENT" | "ADMIN";
  createdAt: string;
  studentProfile: {
    realName: string;
    schoolName: string | null;
    grade: string | null;
    className: string | null;
    number: string | null;
    bio: string | null;
    residenceCountry: string | null;
    birthDate: string | null;
  } | null;
};

type ChildLink = { name: string; email: string; status: string };

const ROLE_LABEL: Record<MeResponse["role"], string> = {
  ADMIN: "관리자",
  FACILITATOR: "퍼실리테이터(강의 담당자)",
  PARENT: "학부모",
  STUDENT: "학생",
};
const STATUS_LABEL: Record<string, string> = { PENDING: "연결 대기중", APPROVED: "연결됨", REJECTED: "거절됨" };

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("ko-KR", { hour12: false });
}
function fmtDay(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

const inputCls = "h-10 w-full rounded-md border border-slate-200/80 bg-transparent px-3 text-sm text-slate-900";
const roCls = "rounded-md border border-slate-200/80 bg-white/40 px-3 py-2 text-sm text-slate-600";

export default function AccountPageClient({ initialMe, childrenLinks = [], facilitatorCourses = [] }: { initialMe: MeResponse; childrenLinks?: ChildLink[]; facilitatorCourses?: { id: string; title: string }[] }) {
  const [me, setMe] = useState(initialMe);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = me.role;
  const isStudent = role === "STUDENT";
  const isParent = role === "PARENT";
  const isFacilitator = role === "FACILITATOR";

  const [form, setForm] = useState({
    realName: initialMe.studentProfile?.realName ?? "",
    schoolName: initialMe.studentProfile?.schoolName ?? "",
    grade: initialMe.studentProfile?.grade ?? "",
  });

  async function onWithdraw() {
    if (!window.confirm("정말 탈퇴하시겠습니까?\n계정과 관련 데이터가 완전히 삭제되며 복구할 수 없습니다.\n(같은 이메일로 즉시 재가입은 가능합니다.)")) return;
    setWithdrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/me/withdraw", { method: "POST" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "탈퇴 처리에 실패했습니다.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setWithdrawing(false);
    }
  }

  async function refreshMe() {
    const res = await fetch("/api/me", { cache: "no-store" });
    const data = (await res.json()) as MeResponse | { error: string };
    if (!res.ok || "error" in data) throw new Error("계정 정보를 다시 불러오지 못했습니다.");
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
      if (!res.ok) throw new Error(data.error ?? "저장에 실패했습니다.");
      await refreshMe();
      setMessage("프로필 정보가 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const p = me.studentProfile;

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
        <div>
          <h1 className="text-3xl font-bold">계정정보</h1>
          <p className="mt-1 text-sm text-slate-500">{ROLE_LABEL[role]} 계정 · 가입 시 입력한 정보를 확인·수정할 수 있습니다.</p>
        </div>

        {message ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <section className="rounded-xl border border-slate-200/70 bg-[color:var(--surface)] p-5">
          <h2 className="text-xl font-semibold text-slate-900">프로필</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSaveProfile}>
            <label className="space-y-1">
              <span className="text-sm text-slate-600">이름(실명) *</span>
              <input className={inputCls} value={form.realName} onChange={(e) => setForm((f) => ({ ...f, realName: e.target.value }))} />
            </label>
            <div className="space-y-1">
              <span className="text-sm text-slate-600">이메일</span>
              <div className={roCls}>{me.email}</div>
            </div>

            {isStudent ? (
              <>
                <div className="space-y-1">
                  <span className="text-sm text-slate-600">거주 국가</span>
                  <div className={roCls}>{p?.residenceCountry || "-"}</div>
                </div>
                <label className="space-y-1">
                  <span className="text-sm text-slate-600">재학중인 학교 *</span>
                  <input className={inputCls} value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} />
                </label>
                <div className="space-y-1">
                  <span className="text-sm text-slate-600">생년월일</span>
                  <div className={roCls}>{fmtDay(p?.birthDate)}</div>
                </div>
                <label className="space-y-1">
                  <span className="text-sm text-slate-600">졸업 예정 연도 *</span>
                  <input className={inputCls} value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} />
                </label>
              </>
            ) : null}

            {isParent ? (
              <div className="space-y-1 md:col-span-2">
                <span className="text-sm text-slate-600">연결된 자녀</span>
                {childrenLinks.length === 0 ? (
                  <div className={roCls}>아직 연결된 자녀가 없습니다. 자녀가 연결 요청을 수락하면 표시됩니다.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {childrenLinks.map((c, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-white/40 px-3 py-2 text-sm">
                        <span className="text-slate-800"><b>{c.name || "학생"}</b> <span className="text-slate-500">({c.email})</span></span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: c.status === "APPROVED" ? "#E7F1EA" : "#F3EFE4", color: c.status === "APPROVED" ? "#3E7E5B" : "#8a5a12" }}>{STATUS_LABEL[c.status] ?? c.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {isFacilitator ? (
              <div className="space-y-1 md:col-span-2">
                <span className="text-sm text-slate-600">담당 강좌 (관리자 배정)</span>
                {facilitatorCourses.length === 0 ? (
                  <div className={roCls}>아직 배정된 담당 강좌가 없습니다. 관리자가 배정하면 표시됩니다.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {facilitatorCourses.map((c) => (
                      <li key={c.id} className="rounded-md border border-slate-200/80 bg-white/40 px-3 py-2 text-sm text-slate-800">{c.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className={roCls}>가입일: {fmtDate(me.createdAt)}</div>
            <div className={roCls}>권한: {ROLE_LABEL[role] ?? "학생"}</div>

            <div className="md:col-span-2 flex justify-end">
              <button disabled={saving} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-60">
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-200/70 pt-5">
            <p className="text-sm font-semibold text-rose-600">회원 탈퇴</p>
            <p className="mt-1 text-xs text-slate-500">탈퇴하면 계정과 관련 데이터가 완전히 삭제됩니다. (같은 이메일로 즉시 재가입 가능)</p>
            <button type="button" onClick={() => void onWithdraw()} disabled={withdrawing} className="mt-3 rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              {withdrawing ? "탈퇴 처리 중…" : "탈퇴하기"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
