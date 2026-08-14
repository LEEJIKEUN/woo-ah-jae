"use client";

import { useMemo, useState } from "react";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);
function getCountryOptions() {
  return Object.values(countries.getNames("en", { select: "official" })).sort((a, b) => a.localeCompare(b));
}

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
const codeInputCls = "h-10 w-40 rounded-md border border-slate-200/80 bg-transparent px-3 text-sm tracking-[0.3em] text-slate-900";
const btnSecondary = "rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50";
const btnDanger = "rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50";

type FacilitatorApp = { university: string; department: string; entranceYear: number | null; phone: string; enrollmentStatus: string; docType: string; status: string };
const ENTRANCE_YEARS = Array.from({ length: 2033 - 2016 + 1 }, (_, i) => String(2016 + i));

export default function AccountPageClient({ initialMe, childrenLinks = [], facilitatorCourses = [], facilitatorApp = null }: { initialMe: MeResponse; childrenLinks?: ChildLink[]; facilitatorCourses?: { id: string; title: string }[]; facilitatorApp?: FacilitatorApp | null }) {
  const [me, setMe] = useState(initialMe);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── 보안: 비밀번호 변경 ──
  const [pwStep, setPwStep] = useState<"idle" | "sent" | "verified">("idle");
  const [pwCode, setPwCode] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  // ── 보안: 회원 탈퇴 ──
  const [wdAgree, setWdAgree] = useState(false);
  const [wdStep, setWdStep] = useState<"idle" | "sent" | "verified">("idle");
  const [wdCode, setWdCode] = useState("");
  const [wdBusy, setWdBusy] = useState(false);
  const [wdMsg, setWdMsg] = useState<string | null>(null);
  const [wdErr, setWdErr] = useState<string | null>(null);

  const role = me.role;
  const isStudent = role === "STUDENT";
  const isParent = role === "PARENT";
  const isFacilitator = role === "FACILITATOR";
  const countryOptions = useMemo(() => getCountryOptions(), []);

  const [form, setForm] = useState({
    realName: initialMe.studentProfile?.realName ?? "",
    schoolName: initialMe.studentProfile?.schoolName || (facilitatorApp ? [facilitatorApp.university, facilitatorApp.department].filter(Boolean).join(" ") : "") || "",
    grade: initialMe.studentProfile?.grade ?? "",
    residenceCountry: initialMe.studentProfile?.residenceCountry ?? "",
    phone: facilitatorApp?.phone ?? "",
    entranceYear: facilitatorApp?.entranceYear ? String(facilitatorApp.entranceYear) : "",
  });

  // 인증코드 발송(비밀번호 변경·탈퇴 공용 엔드포인트)
  async function sendCode(kind: "pw" | "wd") {
    const setBusy = kind === "pw" ? setPwBusy : setWdBusy;
    const setErr = kind === "pw" ? setPwErr : setWdErr;
    const setMsg = kind === "pw" ? setPwMsg : setWdMsg;
    const setStep = kind === "pw" ? setPwStep : setWdStep;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/me/email-code/send", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) { setErr(d.error ?? "인증코드 발송에 실패했습니다."); return; }
      setStep("sent");
      setMsg(d.message ?? "인증코드를 이메일로 보냈습니다.");
    } catch { setErr("네트워크 오류가 발생했습니다."); }
    finally { setBusy(false); }
  }

  // 인증코드 확인
  async function verifyCode(kind: "pw" | "wd") {
    const code = kind === "pw" ? pwCode : wdCode;
    const setBusy = kind === "pw" ? setPwBusy : setWdBusy;
    const setErr = kind === "pw" ? setPwErr : setWdErr;
    const setMsg = kind === "pw" ? setPwMsg : setWdMsg;
    const setStep = kind === "pw" ? setPwStep : setWdStep;
    if (!/^\d{6}$/.test(code)) { setErr("6자리 숫자 코드를 입력해 주세요."); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/me/email-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErr(d.error ?? "인증에 실패했습니다."); return; }
      setStep("verified");
      setMsg(kind === "pw" ? "인증되었습니다. 새 비밀번호를 설정해 주세요." : "인증되었습니다.");
    } catch { setErr("네트워크 오류가 발생했습니다."); }
    finally { setBusy(false); }
  }

  async function onChangePassword() {
    if (pwNew.length < 8) { setPwErr("비밀번호는 8자 이상이어야 합니다."); return; }
    if (pwNew !== pwConfirm) { setPwErr("비밀번호가 일치하지 않습니다."); return; }
    setPwBusy(true); setPwErr(null); setPwMsg(null);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pwNew }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setPwErr(d.error ?? "비밀번호 변경에 실패했습니다."); return; }
      setPwCode(""); setPwNew(""); setPwConfirm(""); setPwErr(null); setPwMsg(null);
      setPwDone(true);
    } catch { setPwErr("네트워크 오류가 발생했습니다."); }
    finally { setPwBusy(false); }
  }

  async function onWithdraw() {
    setWdBusy(true); setWdErr(null);
    try {
      const res = await fetch("/api/me/withdraw", { method: "POST" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setWdErr(d.error ?? "탈퇴 처리에 실패했습니다.");
        return;
      }
      window.location.href = "/withdrawn";
    } catch {
      setWdErr("네트워크 오류가 발생했습니다.");
    } finally {
      setWdBusy(false);
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
          <h1 className="text-3xl font-bold">프로필 수정</h1>
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
              <>
                <label className="space-y-1">
                  <span className="text-sm text-slate-600">소속 대학교 · 학과</span>
                  <input className={inputCls} value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} placeholder="예: 서울대학교 컴퓨터공학과" />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-600">거주 국가</span>
                  <select className={inputCls} value={form.residenceCountry} onChange={(e) => setForm((f) => ({ ...f, residenceCountry: e.target.value }))}>
                    <option value="">국가 선택</option>
                    {countryOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-600">입학연도</span>
                  <select className={inputCls} value={form.entranceYear} onChange={(e) => setForm((f) => ({ ...f, entranceYear: e.target.value }))}>
                    <option value="">선택</option>
                    {ENTRANCE_YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-600">연락처</span>
                  <input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="010-1234-5678" />
                </label>
                <div className="space-y-1">
                  <span className="text-sm text-slate-600">생년월일</span>
                  <div className={roCls}>{fmtDay(p?.birthDate)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-slate-600">학적 상태</span>
                  <div className={roCls}>{facilitatorApp?.enrollmentStatus || "-"}</div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <span className="text-sm text-slate-600">증빙 서류 · 승인 상태</span>
                  <div className={roCls}>{facilitatorApp?.docType || "-"} · {facilitatorApp?.status === "APPROVED" ? "승인 완료" : facilitatorApp?.status === "PENDING" ? "승인 대기" : facilitatorApp?.status || "-"}</div>
                </div>
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
              </>
            ) : null}

            <div className={roCls}>가입일: {fmtDate(me.createdAt)}</div>
            <div className={roCls}>권한: {ROLE_LABEL[role] ?? "학생"}</div>

            <div className="md:col-span-2 flex justify-end">
              <button disabled={saving} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-60">
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </form>
        </section>

        {/* 보안 */}
        <section className="rounded-xl border border-slate-200/70 bg-[color:var(--surface)] p-5">
          <h2 className="text-xl font-semibold text-slate-900">보안</h2>

          {/* 비밀번호 변경 */}
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800">비밀번호 변경</p>
            <p className="mt-1 text-xs text-slate-500">가입한 이메일로 인증코드를 받아 새 비밀번호를 설정합니다.</p>

            {pwDone ? (
              <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
                <p className="text-sm font-semibold text-emerald-800">비밀번호가 변경되었습니다.</p>
                <a href="/login" className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  로그인 페이지로 이동
                </a>
              </div>
            ) : (
            <>
            {pwMsg ? <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{pwMsg}</p> : null}
            {pwErr ? <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{pwErr}</p> : null}

            <div className="mt-3 space-y-2">
              {pwStep === "idle" ? (
                <button type="button" onClick={() => void sendCode("pw")} disabled={pwBusy} className={btnSecondary}>
                  {pwBusy ? "발송 중…" : "인증코드 받기"}
                </button>
              ) : null}

              {pwStep === "sent" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input inputMode="numeric" maxLength={6} value={pwCode} onChange={(e) => setPwCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="인증코드 6자리" className={codeInputCls} />
                  <button type="button" onClick={() => void verifyCode("pw")} disabled={pwBusy} className={btnSecondary}>{pwBusy ? "확인 중…" : "인증"}</button>
                  <button type="button" onClick={() => void sendCode("pw")} disabled={pwBusy} className="text-xs text-slate-400 hover:text-slate-600">재발송</button>
                </div>
              ) : null}

              {pwStep === "verified" ? (
                <div className="space-y-2">
                  <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="새 비밀번호 (8자 이상)" className={inputCls} autoComplete="new-password" />
                  <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="새 비밀번호 확인" className={inputCls} autoComplete="new-password" />
                  <button type="button" onClick={() => void onChangePassword()} disabled={pwBusy} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                    {pwBusy ? "변경 중…" : "비밀번호 변경"}
                  </button>
                </div>
              ) : null}
            </div>
            </>
            )}
          </div>

          {/* 회원 탈퇴 */}
          <div className="mt-6 border-t border-slate-200/70 pt-5">
            <p className="text-sm font-semibold text-rose-600">회원 탈퇴</p>

            {wdMsg ? <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{wdMsg}</p> : null}
            {wdErr ? <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{wdErr}</p> : null}

            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={wdAgree}
                onChange={(e) => {
                  setWdAgree(e.target.checked);
                  if (!e.target.checked) { setWdStep("idle"); setWdCode(""); setWdErr(null); setWdMsg(null); }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <span>계정과 관련 데이터가 완전히 삭제됩니다. 복구가 불가능합니다. 동의하십니까?</span>
            </label>

            {wdAgree ? (
              <div className="mt-3 space-y-2">
                {wdStep === "idle" ? (
                  <button type="button" onClick={() => void sendCode("wd")} disabled={wdBusy} className={btnDanger}>
                    {wdBusy ? "발송 중…" : "인증코드 받기"}
                  </button>
                ) : null}

                {wdStep === "sent" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input inputMode="numeric" maxLength={6} value={wdCode} onChange={(e) => setWdCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="인증코드 6자리" className={codeInputCls} />
                    <button type="button" onClick={() => void verifyCode("wd")} disabled={wdBusy} className={btnDanger}>{wdBusy ? "확인 중…" : "인증"}</button>
                    <button type="button" onClick={() => void sendCode("wd")} disabled={wdBusy} className="text-xs text-slate-400 hover:text-slate-600">재발송</button>
                  </div>
                ) : null}

                {wdStep === "verified" ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50/60 p-3">
                    <p className="text-sm font-semibold text-rose-700">탈퇴하시겠습니까?</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void onWithdraw()} disabled={wdBusy} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                        {wdBusy ? "처리 중…" : "네"}
                      </button>
                      <button type="button" onClick={() => { setWdStep("idle"); setWdCode(""); setWdAgree(false); }} disabled={wdBusy} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white disabled:opacity-50">
                        아니요
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
