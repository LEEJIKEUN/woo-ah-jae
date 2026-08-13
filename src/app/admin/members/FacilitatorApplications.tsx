"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Download } from "lucide-react";

type App = {
  id: string;
  userId: string;
  email: string;
  status: string;
  realName: string;
  birthDate: string | null;
  phone: string;
  university: string;
  department: string;
  entranceYear: number | null;
  enrollmentStatus: string;
  docType: string;
  fileName: string;
  createdAt: string;
};

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function FacilitatorApplications() {
  const [items, setItems] = useState<App[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/facilitators?status=PENDING", { cache: "no-store" });
      const d = (await res.json()) as { items?: App[]; error?: string };
      if (res.ok) setItems(d.items ?? []);
      else setError(d.error ?? "불러오지 못했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("이 신청을 거절할까요?\n계정이 삭제되고 안내 메일이 발송됩니다.")) return;
    setBusyId(id);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/facilitators/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = (await res.json()) as { error?: string };
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== id));
        setMsg(action === "approve" ? "승인 완료 · 안내 메일을 발송했습니다." : "거절 처리 · 안내 메일을 발송했습니다.");
      } else {
        setError(d.error ?? "처리에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  const field = (label: string, value: React.ReactNode) => (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value || "-"}</dd>
    </div>
  );

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold text-slate-900">퍼실리테이터 관리</h2>
      <p className="mt-1 text-sm text-slate-500">가입 신청 내용과 증빙서류를 확인하고 승인·거절하세요. 결과는 신청자 이메일로 자동 안내됩니다.</p>

      {msg ? <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{msg}</p> : null}
      {error ? <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <Card className="mt-4 p-0">
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">대기 중인 신청이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-slate-200/60">
            {items.map((a) => (
              <li key={a.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-slate-900">{a.realName} <span className="ml-1 text-[13px] font-normal text-slate-500">{a.email}</span></p>
                    <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                      {field("생년월일", a.birthDate)}
                      {field("연락처", a.phone)}
                      {field("대학교", a.university)}
                      {field("학과(부)", a.department)}
                      {field("입학연도", a.entranceYear ? `${a.entranceYear}년` : "")}
                      {field("학적", a.enrollmentStatus)}
                      {field("신청일", fmt(a.createdAt))}
                      {field(
                        "증빙",
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{a.docType}</span>
                          <a href={`/api/admin/facilitators/${a.id}/doc`} target="_blank" rel="noreferrer" className="max-w-[180px] truncate text-sky-700 underline">{a.fileName || "파일 보기"}</a>
                          <a href={`/api/admin/facilitators/${a.id}/doc?download=1`} className="text-slate-400 hover:text-slate-600" aria-label="다운로드"><Download size={14} /></a>
                        </span>
                      )}
                    </dl>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => void decide(a.id, "approve")} disabled={busyId === a.id} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">승인</button>
                    <button type="button" onClick={() => void decide(a.id, "reject")} disabled={busyId === a.id} className="rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">거절</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
