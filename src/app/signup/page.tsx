"use client";

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SchoolCombobox from "@/components/signup/SchoolCombobox";
import EmailVerifyField from "@/components/signup/EmailVerifyField";
import { GRADUATION_TERMS } from "@/lib/signup-options";
import { UNIVERSITIES, DEPARTMENTS } from "@/lib/university-options";

const ENTRANCE_YEARS = Array.from({ length: 2033 - 2016 + 1 }, (_, i) => String(2016 + i));

countries.registerLocale(enLocale);

function getCountryOptions() {
  return Object.values(countries.getNames("en", { select: "official" })).sort((a, b) =>
    a.localeCompare(b)
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function SignupPage() {
  const router = useRouter();
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 90 }, (_, i) => String(currentYear - 10 - i)),
    [currentYear]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<"student" | "parent" | "facilitator">("student");
  const [birthYear, setBirthYear] = useState<string>("");
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthDay, setBirthDay] = useState<string>("");

  // 퍼실리테이터 입력값(임시저장 대상)
  const [uniType, setUniType] = useState<"domestic" | "overseas">("domestic");
  const [phone, setPhone] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [entranceYear, setEntranceYear] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState("");
  const [docType, setDocType] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const DRAFT_KEY = "wj_signup_draft";
  const DRAFT_TTL = 10 * 60 * 1000; // 10분

  // 임시저장 복원(10분 이내)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { at?: number; v?: Record<string, unknown> };
        if (d.at && Date.now() - d.at < DRAFT_TTL && d.v) {
          const v = d.v;
          if (typeof v.accountType === "string") setAccountType(v.accountType as "student" | "parent" | "facilitator");
          if (typeof v.email === "string") setEmail(v.email);
          if (typeof v.emailVerified === "boolean") setEmailVerified(v.emailVerified);
          if (typeof v.birthYear === "string") setBirthYear(v.birthYear);
          if (typeof v.birthMonth === "string") setBirthMonth(v.birthMonth);
          if (typeof v.birthDay === "string") setBirthDay(v.birthDay);
          if (typeof v.uniType === "string") setUniType(v.uniType as "domestic" | "overseas");
          if (typeof v.phone === "string") setPhone(v.phone);
          if (typeof v.university === "string") setUniversity(v.university);
          if (typeof v.department === "string") setDepartment(v.department);
          if (typeof v.entranceYear === "string") setEntranceYear(v.entranceYear);
          if (typeof v.enrollmentStatus === "string") setEnrollmentStatus(v.enrollmentStatus);
          if (typeof v.docType === "string") setDocType(v.docType);
        }
      }
    } catch { /* 무시 */ }
    setRestored(true);
  }, []);

  // 임시저장 (복원 이후부터, 변경 시)
  useEffect(() => {
    if (!restored) return;
    try {
      const v = { accountType, email, emailVerified, birthYear, birthMonth, birthDay, uniType, phone, university, department, entranceYear, enrollmentStatus, docType };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), v }));
    } catch { /* 무시 */ }
  }, [restored, accountType, email, emailVerified, birthYear, birthMonth, birthDay, uniType, phone, university, department, entranceYear, enrollmentStatus, docType]);

  const dayOptions = useMemo(() => {
    if (!birthYear || !birthMonth) return [];
    const max = daysInMonth(Number(birthYear), Number(birthMonth));
    return Array.from({ length: max }, (_, i) => String(i + 1));
  }, [birthYear, birthMonth]);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setMessage("제출 중입니다. 잠시만 기다려주세요...");

    try {
      const password = formData.get("password");
      const passwordConfirm = formData.get("passwordConfirm");

      if (
        typeof password !== "string" ||
        typeof passwordConfirm !== "string" ||
        password !== passwordConfirm
      ) {
        setError("비밀번호와 비밀번호 확인이 일치해야 합니다.");
        setMessage(null);
        return;
      }

      if (!emailVerified) {
        setError("이메일 인증을 완료해 주세요.");
        setMessage(null);
        return;
      }

      if (accountType === "parent") {
        const childEmail = formData.get("childEmail");
        if (typeof childEmail !== "string" || !childEmail.trim()) {
          setError("자녀(학생) 이메일을 입력해 주세요.");
          setMessage(null);
          return;
        }
      } else if (accountType === "facilitator") {
        if (!birthYear || !birthMonth || !birthDay) { setError("생년월일을 모두 선택해주세요."); setMessage(null); return; }
        const checks: [string, string][] = [[phone, "연락처"], [university, "소속 대학교"], [department, "소속 학과(부)"], [entranceYear, "입학연도"], [enrollmentStatus, "학적 상태"], [docType, "증빙 서류 종류"]];
        for (const [v, label] of checks) {
          if (!v.trim()) { setError(`${label}을(를) 입력해 주세요.`); setMessage(null); return; }
        }
        if (!docFile || docFile.size === 0) { setError("증빙 서류 파일을 업로드해 주세요."); setMessage(null); return; }
        if (docFile.size > 10 * 1024 * 1024) { setError("증빙 파일이 너무 큽니다. (최대 10MB)"); setMessage(null); return; }
        formData.set("birthDate", `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`);
        formData.set("phone", phone);
        formData.set("university", university);
        formData.set("department", department);
        formData.set("entranceYear", entranceYear);
        formData.set("enrollmentStatus", enrollmentStatus);
        formData.set("docType", docType);
        formData.set("doc", docFile);
      } else {
        if (!birthYear || !birthMonth || !birthDay) {
          setError("생년월일을 모두 선택해주세요.");
          setMessage(null);
          return;
        }
        const iso = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
        formData.set("birthDate", iso);
      }

      // 파일 업로드 진행률 표시를 위해 XHR 사용
      const result = await new Promise<{ ok: boolean; status: number; body: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/auth/signup");
        xhr.timeout = 60000;
        if (accountType === "facilitator") {
          setUploadPct(0);
          xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100)); };
        }
        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText });
        xhr.onerror = () => reject(new Error("network"));
        xhr.ontimeout = () => reject(new Error("timeout"));
        xhr.send(formData);
      });
      setUploadPct(null);

      const data = (JSON.parse(result.body || "{}")) as { error?: string };
      if (!result.ok) {
        setError(data.error ?? "회원가입 중 오류가 발생했습니다.");
        setMessage(null);
        return;
      }

      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* 무시 */ }
      setMessage("제출이 완료되었습니다. 완료 화면으로 이동합니다.");
      router.push(accountType === "facilitator" ? "/signup/success?pending=1" : "/signup/success");
    } catch {
      setError("서버 응답이 지연되거나 연결에 문제가 있습니다. 다시 시도해주세요.");
      setMessage(null);
    } finally {
      setLoading(false);
      setUploadPct(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">회원가입</h1>
      <p className="mb-8 text-slate-500">
        회원가입 후 바로 로그인하여 우아재를 이용하실 수 있습니다.
      </p>

      <form action={onSubmit} className="space-y-5 rounded-2xl border bg-[color:var(--surface)] p-6">
        <input type="hidden" name="accountType" value={accountType} />

        {/* 가입 유형 */}
        <div className="space-y-1.5">
          <span className="text-sm font-medium">가입 유형</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              { key: "student", label: "학생", desc: "강의 수강" },
              { key: "parent", label: "학부모", desc: "자녀 진도 열람" },
              { key: "facilitator", label: "퍼실리테이터", desc: "멘토 담당" },
            ] as const).map((t) => {
              const active = accountType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setAccountType(t.key)}
                  className="rounded-md border px-3 py-2.5 text-left transition"
                  style={{
                    borderColor: active ? "#4E6B5A" : "#e2e8f0",
                    background: active ? "rgba(78,107,90,0.08)" : "transparent",
                  }}
                >
                  <span className="block text-[14px] font-bold" style={{ color: active ? "#4E6B5A" : "#334155" }}>{t.label}</span>
                  <span className="block text-[12px] text-slate-500">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="block space-y-1">
          <span className="text-sm font-medium">이메일 (인증 필요)</span>
          <EmailVerifyField onVerifiedChange={setEmailVerified} onEmailChange={setEmail} initialEmail={email} initialVerified={emailVerified} />
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">비밀번호</span>
          <input name="password" type="password" minLength={8} required className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="8자 이상" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">비밀번호 확인</span>
          <input name="passwordConfirm" type="password" minLength={8} required className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="비밀번호 재입력" />
        </label>

        {accountType === "student" ? (
        <>
        <label className="block space-y-1">
          <span className="text-sm font-medium">거주 국가</span>
          <select name="residenceCountry" required className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
            <option value="">국가 선택</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </label>

        <div className="block space-y-1">
          <span className="text-sm font-medium">재학중인 학교명</span>
          <SchoolCombobox required />
          <p className="text-xs text-slate-500">국내 중·고등학교 및 재외한국학교를 검색해 선택하세요.</p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">생년월일</span>
          <div className="grid grid-cols-3 gap-3">
            <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" required>
              <option value="">년도</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" required>
              <option value="">월</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
            <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" required>
              <option value="">일</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <input type="hidden" name="birthDate" value={birthYear && birthMonth && birthDay ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : ""} />
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">졸업 예정 연도</span>
          <select name="grade" required defaultValue="" className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
            <option value="">졸업 예정 연도 선택</option>
            {GRADUATION_TERMS.map((term) => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
        </label>
        </>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium">이름(실명)</span>
          <input
            name="realName"
            required
            className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2"
            placeholder="실명을 입력하세요"
          />
        </label>

        {accountType === "parent" ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">자녀(학생) 이메일</span>
            <input
              name="childEmail"
              type="email"
              required
              autoComplete="off"
              className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2"
              placeholder="자녀가 가입한 이메일 주소"
            />
            <p className="text-xs text-slate-500">회원가입 후, 학생 계정(이메일)으로 이메일 인증 요청이 전송되고, 자녀가 수락하면 학습 현황 및 탐구활동 멘토링 열람이 가능합니다.</p>
          </label>
        ) : null}

        {accountType === "facilitator" ? (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium">생년월일</span>
              <div className="grid grid-cols-3 gap-3">
                <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
                  <option value="">년도</option>
                  {yearOptions.map((year) => (<option key={year} value={year}>{year}</option>))}
                </select>
                <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
                  <option value="">월</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (<option key={month} value={month}>{month}</option>))}
                </select>
                <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
                  <option value="">일</option>
                  {dayOptions.map((day) => (<option key={day} value={day}>{day}</option>))}
                </select>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium">연락처</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="off" placeholder="010-1234-5678" className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" />
            </label>

            {/* 국내대 / 해외대 */}
            <div className="space-y-1.5">
              <span className="text-sm font-medium">대학 구분</span>
              <div className="grid grid-cols-2 gap-2">
                {([["domestic", "국내 대학"], ["overseas", "해외 대학"]] as const).map(([k, label]) => {
                  const active = uniType === k;
                  return (
                    <button key={k} type="button" onClick={() => { setUniType(k); setUniversity(""); setDepartment(""); }} className="rounded-md border px-3 py-2 text-[14px] font-semibold transition" style={{ borderColor: active ? "#4E6B5A" : "#e2e8f0", background: active ? "rgba(78,107,90,0.08)" : "transparent", color: active ? "#4E6B5A" : "#334155" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium">소속 대학교</span>
              {uniType === "domestic" ? (
                <>
                  <input value={university} onChange={(e) => setUniversity(e.target.value)} list="universities" autoComplete="off" placeholder="대학교명을 입력·검색" className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" />
                  <datalist id="universities">{UNIVERSITIES.map((u) => (<option key={u} value={u} />))}</datalist>
                </>
              ) : (
                <input value={university} onChange={(e) => setUniversity(e.target.value)} autoComplete="off" placeholder="해외 대학교명을 직접 입력" className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" />
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">소속 학과(부)</span>
              {uniType === "domestic" ? (
                <>
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} list="departments" autoComplete="off" placeholder="학과(부)명을 입력·검색" className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" />
                  <datalist id="departments">{DEPARTMENTS.map((d) => (<option key={d} value={d} />))}</datalist>
                </>
              ) : (
                <input value={department} onChange={(e) => setDepartment(e.target.value)} autoComplete="off" placeholder="학과(부)명을 직접 입력" className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" />
              )}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium">입학연도</span>
                <select value={entranceYear} onChange={(e) => setEntranceYear(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
                  <option value="">선택</option>
                  {ENTRANCE_YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">학적 상태</span>
                <select value={enrollmentStatus} onChange={(e) => setEnrollmentStatus(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
                  <option value="">선택</option>
                  <option value="재학">재학</option>
                  <option value="휴학">휴학</option>
                </select>
              </label>
            </div>

            <div className="block space-y-1">
              <span className="text-sm font-medium">증빙 서류</span>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
                <option value="">서류 종류 선택 (택 1)</option>
                <option value="재적증명서">재적증명서</option>
                <option value="재학증명서">재학증명서</option>
                <option value="휴학증명서">휴학증명서</option>
                <option value="성적증명서">성적증명서</option>
                <option value="기타">기타</option>
              </select>

              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) { setError("증빙 파일이 너무 큽니다. (최대 10MB)"); return; }
                  setError(null);
                  setDocFile(f);
                }}
              />

              {uploadPct !== null ? (
                <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-3">
                  <p className="mb-1.5 text-[13px] font-semibold text-slate-700">업로드 중… {uploadPct}%</p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: "#4E6B5A" }} />
                  </div>
                </div>
              ) : docFile ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                  <span className="min-w-0 text-[13.5px]">
                    <span className="block truncate font-semibold text-slate-800">📎 {docFile.name}</span>
                    <span className="text-[12px] text-slate-500">{(docFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => docInputRef.current?.click()} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">변경</button>
                    <button type="button" onClick={() => setDocFile(null)} className="rounded-md border border-rose-300 px-2.5 py-1.5 text-[12px] font-semibold text-rose-600 hover:bg-rose-50">삭제</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-6 text-center transition hover:border-[#4E6B5A]"
                  style={{ borderColor: "#cbd5e1" }}
                >
                  <span className="text-[15px] font-semibold text-slate-700">＋ 증빙 서류 업로드</span>
                  <span className="text-[12px] text-slate-500">PDF 또는 이미지 파일 (최대 10MB)</span>
                </button>
              )}
              <p className="mt-1 text-xs text-slate-500">관리자 승인 후 가입이 완료됩니다.</p>
            </div>
          </>
        ) : null}

        {message ? <p className="rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-600">{message}</p> : null}
        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p> : null}

        {!emailVerified ? (
          <p className="text-xs text-slate-500">회원가입을 완료하려면 먼저 이메일 인증을 진행해 주세요.</p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !emailVerified}
          className="w-full rounded-[4px] px-4 py-2.5 text-[15px] font-bold text-white disabled:opacity-60"
          style={{ background: "#4E6B5A" }}
        >
          {loading ? "회원가입 처리 중..." : "회원가입"}
        </button>
      </form>
    </main>
  );
}
