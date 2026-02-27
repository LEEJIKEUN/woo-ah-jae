"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-400";

export default function ApplyForm({
  projectId,
  questions,
}: {
  projectId: string;
  questions: Array<string | null | undefined>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        const formData = new FormData(event.currentTarget);
        const payload = {
          applicantIntro: String(formData.get("applicantIntro") || "").trim(),
          contact: String(formData.get("contact") || "").trim(),
          answer1: String(formData.get("answer1") || "").trim(),
          answer2: String(formData.get("answer2") || "").trim(),
          answer3: String(formData.get("answer3") || "").trim(),
        };

        try {
          const res = await fetch(`/api/projects/${projectId}/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = (await res.json()) as { error?: string; message?: string };
          if (!res.ok) {
            throw new Error(json.error ?? "지원서 제출에 실패했습니다.");
          }

          setMessage(json.message ?? "신청이 완료되었습니다. 프로젝트 관리자의 승인을 기다려주세요.");
          setTimeout(() => {
            router.push(`/projects/${projectId}`);
            router.refresh();
          }, 1000);
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "지원서 제출에 실패했습니다.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">자기소개</span>
        <textarea name="applicantIntro" rows={4} className={INPUT_CLASS} required maxLength={2000} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">연락 가능한 수단</span>
        <input name="contact" className={INPUT_CLASS} required maxLength={300} placeholder="예: 카카오톡 ID, 이메일" />
      </label>

      {questions.map((question, index) => {
        if (!question) return null;

        return (
          <label key={`q-${index}`} className="block space-y-1">
            <span className="text-sm text-slate-300">질문 {index + 1}. {question}</span>
            <textarea name={`answer${index + 1}`} rows={3} className={INPUT_CLASS} maxLength={2000} required />
          </label>
        );
      })}

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        disabled={loading}
        className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-60"
      >
        {loading ? "제출 중..." : "신청하기 제출"}
      </button>
    </form>
  );
}
