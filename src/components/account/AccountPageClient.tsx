"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type VerificationStatus = "NOT_SUBMITTED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
type VerificationDocType = "STUDENT_ID" | "ENROLLMENT_CERTIFICATE";

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
  verificationStatus: VerificationStatus;
  verificationSubmission: {
    id: string;
    status: VerificationStatus;
    docType: VerificationDocType;
    submittedAt: string;
    reviewedAt: string | null;
    rejectReasonCode: string | null;
    rejectReasonText: string | null;
  } | null;
};

type ActivityResponse = {
  owned: Array<{
    id: string;
    title: string;
    tab: string | null;
    channel: string | null;
    status: "OPEN" | "CLOSED";
    createdAt: string;
  }>;
  joined: Array<{
    id: string;
    title: string;
    tab: string | null;
    channel: string | null;
    status: "OPEN" | "CLOSED";
    createdAt: string;
    joinedAt: string;
  }>;
  applied: Array<{
    id: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    createdAt: string;
    project: {
      id: string;
      title: string;
      tab: string | null;
      channel: string | null;
      status: "OPEN" | "CLOSED";
    };
  }>;
};

type Props = {
  initialMe: MeResponse;
  initialActivity: ActivityResponse;
};

const statusMap: Record<VerificationStatus, { label: string; className: string }> = {
  NOT_SUBMITTED: { label: "미제출", className: "bg-slate-700/70 text-slate-200" },
  PENDING_REVIEW: { label: "검토중", className: "bg-amber-500/20 text-amber-200" },
  VERIFIED: { label: "승인됨", className: "bg-emerald-500/20 text-emerald-200" },
  REJECTED: { label: "반려됨", className: "bg-rose-500/20 text-rose-200" },
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("ko-KR", { hour12: false });
}

function appStatusLabel(status: "PENDING" | "ACCEPTED" | "REJECTED") {
  if (status === "ACCEPTED") return "수락";
  if (status === "REJECTED") return "거절";
  return "대기";
}

export default function AccountPageClient({ initialMe, initialActivity }: Props) {
  const [me, setMe] = useState(initialMe);
  const [activity] = useState(initialActivity);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const [docType, setDocType] = useState<VerificationDocType>("STUDENT_ID");
  const [docFile, setDocFile] = useState<File | null>(null);

  const verificationStatus = useMemo(() => {
    return statusMap[me.verificationStatus] ?? statusMap.NOT_SUBMITTED;
  }, [me.verificationStatus]);

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

  async function onSubmitVerification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!docFile) {
      setError("인증 파일을 선택해주세요.");
      return;
    }

    setUploading(true);
    setMessage(null);
    setError(null);

    try {
      const fd = new FormData();
      fd.set("docType", docType);
      fd.set("file", docFile);

      const res = await fetch("/api/me/verification", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "인증 제출에 실패했습니다.");
      }
      await refreshMe();
      setDocFile(null);
      setMessage("인증 서류가 제출되었습니다. 관리자 승인 후 상태가 갱신됩니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 제출 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
        <div>
          <h1 className="text-3xl font-bold">계정정보</h1>
          <p className="mt-1 text-sm text-slate-400">프로필과 학생 인증 상태를 관리하고, 내 활동을 확인할 수 있습니다.</p>
        </div>

        {message ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        <section className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
          <h2 className="text-xl font-semibold text-slate-100">프로필</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSaveProfile}>
            <label className="space-y-1">
              <span className="text-sm text-slate-300">실명 *</span>
              <input className="h-10 w-full rounded-md border border-slate-600/80 bg-transparent px-3 text-sm text-slate-100" value={form.realName} onChange={(e) => setForm((p) => ({ ...p, realName: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-300">학교 *</span>
              <input className="h-10 w-full rounded-md border border-slate-600/80 bg-transparent px-3 text-sm text-slate-100" value={form.schoolName} onChange={(e) => setForm((p) => ({ ...p, schoolName: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-300">학년 *</span>
              <input className="h-10 w-full rounded-md border border-slate-600/80 bg-transparent px-3 text-sm text-slate-100" value={form.grade} onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-300">반</span>
              <input className="h-10 w-full rounded-md border border-slate-600/80 bg-transparent px-3 text-sm text-slate-100" value={form.className} onChange={(e) => setForm((p) => ({ ...p, className: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-300">번호</span>
              <input className="h-10 w-full rounded-md border border-slate-600/80 bg-transparent px-3 text-sm text-slate-100" value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm text-slate-300">소개</span>
              <textarea className="min-h-24 w-full rounded-md border border-slate-600/80 bg-transparent px-3 py-2 text-sm text-slate-100" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} />
            </label>

            <div className="rounded-md border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">가입일: {fmtDate(me.createdAt)}</div>
            <div className="rounded-md border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">권한: {me.role === "ADMIN" ? "관리자" : "학생"}</div>

            <div className="md:col-span-2 flex justify-end">
              <button disabled={saving} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-60">
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-100">학생 인증 상태</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verificationStatus.className}`}>{verificationStatus.label}</span>
          </div>

          <div className="mt-3 space-y-1 text-sm text-slate-300">
            <p>최근 제출일: {fmtDate(me.verificationSubmission?.submittedAt)}</p>
            <p>최근 검토일: {fmtDate(me.verificationSubmission?.reviewedAt)}</p>
            {me.verificationSubmission?.rejectReasonText ? <p className="text-rose-300">반려 사유: {me.verificationSubmission.rejectReasonText}</p> : null}
          </div>

          {(me.verificationStatus === "NOT_SUBMITTED" || me.verificationStatus === "PENDING_REVIEW" || me.verificationStatus === "REJECTED") ? (
            <form className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]" onSubmit={onSubmitVerification}>
              <label className="space-y-1">
                <span className="text-sm text-slate-300">문서 종류</span>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as VerificationDocType)}
                  className="h-10 w-full rounded-md border border-slate-600/80 bg-transparent px-3 text-sm text-slate-100"
                >
                  <option value="STUDENT_ID">학생증</option>
                  <option value="ENROLLMENT_CERTIFICATE">재학증명서</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm text-slate-300">인증 파일</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  className="block h-10 w-full rounded-md border border-slate-600/80 bg-transparent px-3 py-2 text-sm text-slate-100"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="flex items-end">
                <button disabled={uploading} className="h-10 rounded-md border border-slate-400 px-4 text-sm font-semibold text-slate-100 hover:border-slate-200 disabled:opacity-60">
                  {uploading ? "제출 중..." : "업로드/재업로드"}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-100">내 활동 요약</h2>
            <Link href="/me/projects" className="text-sm text-slate-300 hover:text-slate-100">내 프로젝트 관리로 이동</Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="space-y-2 rounded-lg border border-slate-700/70 bg-slate-900/30 p-3">
              <h3 className="text-sm font-semibold text-slate-100">내가 만든 프로젝트</h3>
              {activity.owned.length === 0 ? <p className="text-xs text-slate-400">생성한 프로젝트가 없습니다.</p> : (
                <ul className="space-y-2">
                  {activity.owned.map((item) => (
                    <li key={item.id} className="text-xs text-slate-300">
                      <Link className="font-medium text-slate-100 hover:text-white" href={`/projects/${item.id}`}>{item.title}</Link>
                      <p className="text-slate-400">{item.tab ?? "-"} · {item.channel ?? "-"} · {item.status === "OPEN" ? "모집중" : "마감"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="space-y-2 rounded-lg border border-slate-700/70 bg-slate-900/30 p-3">
              <h3 className="text-sm font-semibold text-slate-100">참여중인 프로젝트</h3>
              {activity.joined.length === 0 ? <p className="text-xs text-slate-400">참여중인 프로젝트가 없습니다.</p> : (
                <ul className="space-y-2">
                  {activity.joined.map((item) => (
                    <li key={item.id} className="text-xs text-slate-300">
                      <Link className="font-medium text-slate-100 hover:text-white" href={`/projects/${item.id}`}>{item.title}</Link>
                      <p className="text-slate-400">{item.tab ?? "-"} · {item.channel ?? "-"}</p>
                      <Link href={`/workspace/${item.id}`} className="text-slate-200 underline-offset-2 hover:underline">워크스페이스 이동</Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="space-y-2 rounded-lg border border-slate-700/70 bg-slate-900/30 p-3">
              <h3 className="text-sm font-semibold text-slate-100">지원한 프로젝트</h3>
              {activity.applied.length === 0 ? <p className="text-xs text-slate-400">지원 내역이 없습니다.</p> : (
                <ul className="space-y-2">
                  {activity.applied.map((item) => (
                    <li key={item.id} className="text-xs text-slate-300">
                      <Link className="font-medium text-slate-100 hover:text-white" href={`/projects/${item.project.id}`}>{item.project.title}</Link>
                      <p className="text-slate-400">상태: {appStatusLabel(item.status)} · {fmtDate(item.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
