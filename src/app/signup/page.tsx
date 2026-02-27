"use client";

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GRADE_OPTIONS, OVERSEAS_KOREAN_SCHOOLS } from "@/lib/signup-options";

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
  const countries = useMemo(() => getCountryOptions(), []);
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 90 }, (_, i) => String(currentYear - 10 - i)),
    [currentYear]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>(OVERSEAS_KOREAN_SCHOOLS[0]);
  const [birthYear, setBirthYear] = useState<string>("");
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthDay, setBirthDay] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const verificationFileRef = useRef<HTMLInputElement | null>(null);

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

      if (!birthYear || !birthMonth || !birthDay) {
        setError("생년월일을 모두 선택해주세요.");
        setMessage(null);
        return;
      }
      const verificationFile = formData.get("verificationFile");
      if (!(verificationFile instanceof File) || verificationFile.size === 0) {
        setError("학생증 또는 재학증명서 파일을 업로드해주세요.");
        setMessage(null);
        return;
      }

      const y = Number(birthYear);
      const m = Number(birthMonth);
      const d = Number(birthDay);
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      formData.set("birthDate", iso);

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

      setMessage("제출이 완료되었습니다. 승인 대기 화면으로 이동합니다.");
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
      <p className="mb-8 text-slate-400">
        회원가입 후 관리자 승인 완료 시 커뮤니티 기능을 이용할 수 있습니다.
      </p>

      <form action={onSubmit} className="space-y-5 rounded-2xl border bg-[color:var(--surface)] p-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium">1. 이메일</span>
          <input name="email" type="email" required className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="you@example.com" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">2. 비밀번호</span>
          <input name="password" type="password" minLength={8} required className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="8자 이상" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">2. 비밀번호 확인</span>
          <input name="passwordConfirm" type="password" minLength={8} required className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="비밀번호 재입력" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">3. 거주 국가</span>
          <select name="residenceCountry" required className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2">
            <option value="">국가 선택</option>
            {countries.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">4. 재학중인 학교명</span>
          <select
            name="schoolName"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
            className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2"
          >
            {OVERSEAS_KOREAN_SCHOOLS.map((school) => (
              <option key={school} value={school}>{school}</option>
            ))}
            <option value="OTHER">해당 없음 (직접 입력)</option>
          </select>
        </label>

        {schoolName === "OTHER" ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">학교명 직접 입력</span>
            <input name="schoolNameCustom" required className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" placeholder="학교명을 입력하세요" />
          </label>
        ) : (
          <input type="hidden" name="schoolNameCustom" value="" />
        )}

        <div className="space-y-2">
          <span className="text-sm font-medium">5. 생년월일</span>
          <div className="grid grid-cols-3 gap-3">
            <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" required>
              <option value="">년도</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" required>
              <option value="">월</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
            <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" required>
              <option value="">일</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <input type="hidden" name="birthDate" value={birthYear && birthMonth && birthDay ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : ""} />
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">6. 학년</span>
          <select name="grade" required className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2">
            <option value="">학년 선택</option>
            {GRADE_OPTIONS.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">7. 이름(실명)</span>
          <input
            name="realName"
            required
            className="w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2"
            placeholder="실명을 입력하세요"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">8. 학생증 또는 재학증명서 업로드</span>
          <div className="relative w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2 text-left text-slate-100">
            <input
              ref={verificationFileRef}
              name="verificationFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic,.png,.jpg,.jpeg,.webp,.heic,.pdf"
              required
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                setSelectedFileName(file?.name ?? "");
              }}
            />
            <span className="block truncate text-sm text-slate-200">
              {selectedFileName || "학생증/재학증명서 파일을 선택하세요"}
            </span>
          </div>
          <p className="text-xs text-slate-500">사진 촬영 업로드 또는 저장된 파일 업로드 가능 (최대 10MB)</p>
        </label>

        {message ? <p className="rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-300">{message}</p> : null}
        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 disabled:opacity-60"
        >
          {loading ? "회원가입 처리 중..." : "회원가입"}
        </button>
      </form>
    </main>
  );
}
