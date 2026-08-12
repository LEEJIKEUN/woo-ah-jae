"use client";

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SchoolCombobox from "@/components/signup/SchoolCombobox";
import EmailVerifyField from "@/components/signup/EmailVerifyField";
import { GRADUATION_TERMS } from "@/lib/signup-options";

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
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [accountType, setAccountType] = useState<"student" | "parent">("student");
  const [birthYear, setBirthYear] = useState<string>("");
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthDay, setBirthDay] = useState<string>("");

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
      } else {
        if (!birthYear || !birthMonth || !birthDay) {
          setError("생년월일을 모두 선택해주세요.");
          setMessage(null);
          return;
        }

        if (isFacilitator) {
          const code = formData.get("facilitatorCode");
          if (typeof code !== "string" || !code.trim()) {
            setError("퍼실리테이터 초대코드를 입력해 주세요.");
            setMessage(null);
            return;
          }
        }

        const y = Number(birthYear);
        const m = Number(birthMonth);
        const d = Number(birthDay);
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        formData.set("birthDate", iso);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "회원가입 중 오류가 발생했습니다.");
        setMessage(null);
        return;
      }

      setMessage("회원가입이 완료되었습니다. 완료 화면으로 이동합니다.");
      router.push("/signup/success");
    } catch {
      setError("서버 응답이 지연되거나 연결에 문제가 있습니다. 다시 시도해주세요.");
      setMessage(null);
    } finally {
      setLoading(false);
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
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "student", label: "학생", desc: "강의 수강" },
              { key: "parent", label: "학부모", desc: "자녀 진도 열람" },
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
          {accountType === "parent" ? (
            <p className="text-xs text-slate-500">학부모는 이름·이메일·비밀번호와 자녀 이메일만 입력하면 됩니다. 자녀가 연결을 수락하면 진도를 볼 수 있어요.</p>
          ) : null}
        </div>

        <div className="block space-y-1">
          <span className="text-sm font-medium">1. 이메일 (인증 필요)</span>
          <EmailVerifyField onVerifiedChange={setEmailVerified} />
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">2. 비밀번호</span>
          <input name="password" type="password" minLength={8} required className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="8자 이상" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">2. 비밀번호 확인</span>
          <input name="passwordConfirm" type="password" minLength={8} required className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="비밀번호 재입력" />
        </label>

        {accountType === "student" ? (
        <>
        <label className="block space-y-1">
          <span className="text-sm font-medium">3. 거주 국가</span>
          <select name="residenceCountry" required className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2">
            <option value="">국가 선택</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </label>

        <div className="block space-y-1">
          <span className="text-sm font-medium">4. 재학중인 학교명</span>
          <SchoolCombobox required />
          <p className="text-xs text-slate-500">국내 중·고등학교 및 재외한국학교를 검색해 선택하세요.</p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">5. 생년월일</span>
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
          <span className="text-sm font-medium">6. 졸업 예정 연도</span>
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
          <span className="text-sm font-medium">7. 이름(실명)</span>
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
            <p className="text-xs text-slate-500">이 학생 계정으로 연결 요청이 전송되고, 자녀가 수락하면 진도 열람이 가능합니다.</p>
          </label>
        ) : null}

        {/* 8. 퍼실리테이터(강의 담당자) 가입 — 초대코드 보유 시에만 (학생 유형에서만) */}
        {accountType === "student" ? (
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isFacilitator}
              onChange={(e) => setIsFacilitator(e.target.checked)}
              className="h-4 w-4"
            />
            강의 담당자(퍼실리테이터)로 가입
          </label>
          <p className="text-xs text-slate-500">
            담당 강의가 있는 경우 체크하고 발급받은 초대코드를 입력하세요. (예: 인공지능을 위한 선형대수학 담당자)
          </p>
          {isFacilitator ? (
            <input
              name="facilitatorCode"
              type="text"
              autoComplete="off"
              className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2"
              placeholder="퍼실리테이터 초대코드"
            />
          ) : null}
        </div>
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
