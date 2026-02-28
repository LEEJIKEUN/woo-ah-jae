"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { formatKstDate } from "@/lib/date-format";

type Item = {
  id: string;
  status: "NOT_SUBMITTED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
  docType?: "STUDENT_ID" | "ENROLLMENT_CERT";
  originalFilename?: string;
  mimeType?: string;
  submittedAt: string;
  rejectReasonText: string | null;
  user: {
    email: string;
    studentProfile: {
      schoolName: string;
      grade: string;
      residenceCountry: string | null;
      birthDate: string | null;
    } | null;
  };
};

const STATUS_OPTIONS = [
  { label: "전체", value: "ALL" },
  { label: "검토대기", value: "PENDING_REVIEW" },
  { label: "승인", value: "VERIFIED" },
  { label: "거절", value: "REJECTED" },
] as const;

export default function AdminVerificationPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("PENDING_REVIEW");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }, [q, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/verifications?${qs}`);
      const data = (await res.json()) as { items?: Item[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? (res.status === 401 ? "관리자 로그인 후 이용 가능합니다." : "신청자 목록을 불러오지 못했습니다."));
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setProcessingId(id);
    setError(null);
    try {
      const body = decision === "APPROVE" ? { decision } : { decision, rejectReasonCode: "MANUAL_REJECT", rejectReasonText: "관리자 수동 반려" };
      const res = await fetch(`/api/admin/verifications/${id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "처리 중 오류가 발생했습니다.");
        return;
      }
      await load();
    } catch {
      setError("처리 중 네트워크 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section id="verification" className="mt-8 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">가입 신청 승인 큐</h2>
        <p className="mt-1 text-sm text-slate-400">신청자의 인증 상태를 확인하고 승인/거절할 수 있습니다.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이메일/학교명 검색" className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-600 bg-[color:var(--surface)] px-3 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]["value"])} className="h-9 rounded-md border border-slate-600 bg-[color:var(--surface)] px-3 text-sm">
          {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button onClick={() => void load()} className="h-9 rounded-md border border-slate-500 px-3 text-sm text-slate-200">새로고침</button>
      </div>

      {loading ? <p className="text-sm text-slate-400">불러오는 중...</p> : null}
      {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}

      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">신청 내역이 없습니다.</div>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="space-y-2 p-4">
              <p className="text-sm font-medium text-slate-100">{item.user.email}</p>
              <p className="text-xs text-slate-400">
                {item.user.studentProfile?.schoolName ?? "-"} · {item.user.studentProfile?.grade ?? "-"} · {item.user.studentProfile?.residenceCountry ?? "-"}
              </p>
              <p className="text-xs text-slate-400">상태: {item.status} · 제출일: {formatKstDate(item.submittedAt)}</p>
              <div className="space-y-2 rounded-md border border-slate-700/70 bg-slate-900/40 p-2">
                <p className="text-[11px] text-slate-400">
                  제출 문서: {item.docType === "ENROLLMENT_CERT" ? "재학증명서" : "학생증"} · {item.originalFilename ?? "파일"}
                </p>
                {item.mimeType?.startsWith("image/") ? (
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="group block"
                    aria-label="신원확인 이미지 크게 보기"
                  >
                    <img
                      src={`/api/admin/verifications/${item.id}/file`}
                      alt="신원확인 문서 미리보기"
                      className="h-28 w-44 rounded-md border border-slate-700 object-cover transition group-hover:opacity-90"
                    />
                  </button>
                ) : (
                  <a
                    href={`/api/admin/verifications/${item.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    문서 보기
                  </a>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => void decide(item.id, "APPROVE")} disabled={item.status !== "PENDING_REVIEW" || processingId === item.id} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">승인</button>
                <button onClick={() => void decide(item.id, "REJECT")} disabled={item.status !== "PENDING_REVIEW" || processingId === item.id} className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">거절</button>
              </div>
            </Card>
          ))
        )}
      </div>

      {previewItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="신원확인 이미지 확대 보기"
          onClick={() => setPreviewItem(null)}
        >
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="max-w-[70vw] truncate text-xs text-slate-200">{previewItem.originalFilename ?? "문서 이미지"}</p>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                닫기
              </button>
            </div>
            <img
              src={`/api/admin/verifications/${previewItem.id}/file`}
              alt="신원확인 문서 확대"
              className="max-h-[82vh] max-w-[90vw] rounded-md border border-slate-700 object-contain"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
