"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminVerificationPanel from "@/components/admin-verification-panel";
import Card from "@/components/ui/Card";
import { formatKstDate } from "@/lib/date-format";

type MemberItem = {
  id: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  schoolName: string | null;
  grade: string | null;
  residenceCountry: string | null;
  verificationStatus: "NOT_SUBMITTED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED" | "UNKNOWN";
  planCode: string;
  entitlementStatus: "ACTIVE" | "EXPIRED" | "CANCELED" | "NONE";
  createdAt: string;
};

export default function AdminMembersPage() {
  const [items, setItems] = useState<MemberItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [source, setSource] = useState<"db" | "local" | "-">("-");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members${qs ? `?${qs}` : ""}`);
      const data = (await res.json()) as {
        items?: MemberItem[];
        billingEnabled?: boolean;
        source?: "db" | "local";
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "회원 목록을 불러오지 못했습니다.");
        return;
      }

      setItems(data.items ?? []);
      setBillingEnabled(Boolean(data.billingEnabled));
      setSource(data.source ?? "-");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void load();
    }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  async function memberAction(id: string, action: "WITHDRAW") {
    setProcessingMemberId(id);
    setError(null);
    try {
      const ok = window.confirm("정말 탈퇴 처리하시겠습니까? 계정과 연관 데이터가 즉시 삭제됩니다.");
      if (!ok) return;

      const res = await fetch(`/api/admin/members/${id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "회원 처리 중 오류가 발생했습니다.");
        return;
      }
      await load();
    } catch {
      setError("회원 처리 중 네트워크 오류가 발생했습니다.");
    } finally {
      setProcessingMemberId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)]">
      <section className="mx-auto max-w-6xl space-y-4 px-6 py-10">
        <h1 className="text-3xl font-bold text-slate-100">회원 관리 (구독관리)</h1>
        <p className="text-sm text-slate-400">구독/인증 상태를 실시간에 가깝게 관리할 수 있도록 구성된 관리자 화면입니다.</p>

        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이메일 검색" className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-600 bg-[color:var(--surface)] px-3 text-sm" />
          <button onClick={() => void load()} className="h-9 rounded-md border border-slate-500 px-3 text-sm text-slate-200">새로고침</button>
          <button onClick={() => setAutoRefresh((v) => !v)} className="h-9 rounded-md border border-slate-500 px-3 text-sm text-slate-200">자동갱신: {autoRefresh ? "ON" : "OFF"}</button>
        </div>

        <p className="text-xs text-slate-400">데이터 소스: {source} · billingEnabled: {String(billingEnabled)}</p>

        {loading ? <p className="text-sm text-slate-400">불러오는 중...</p> : null}
        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}

        <Card className="overflow-hidden p-0">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">회원 데이터가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">이메일</th>
                    <th className="px-3 py-3">권한</th>
                    <th className="px-3 py-3">학교</th>
                    <th className="px-3 py-3">학년</th>
                    <th className="px-3 py-3">국가</th>
                    <th className="px-3 py-3">인증</th>
                    <th className="px-3 py-3">플랜</th>
                    <th className="px-3 py-3">구독</th>
                    <th className="px-3 py-3">가입일</th>
                    <th className="px-3 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => (
                    <tr key={x.id} className="border-t border-slate-700/60 hover:bg-slate-800/30">
                      <td className="max-w-[260px] truncate px-4 py-3 font-medium text-slate-100">{x.email}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{x.role}</td>
                      <td className="max-w-[200px] truncate px-3 py-3 text-xs text-slate-300">{x.schoolName ?? "-"}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{x.grade ?? "-"}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{x.residenceCountry ?? "-"}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{x.verificationStatus}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{x.planCode}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{x.entitlementStatus}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400">{formatKstDate(x.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => void memberAction(x.id, "WITHDRAW")}
                          disabled={processingMemberId === x.id}
                          className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                        >
                          탈퇴
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <AdminVerificationPanel />
      </section>
    </main>
  );
}
