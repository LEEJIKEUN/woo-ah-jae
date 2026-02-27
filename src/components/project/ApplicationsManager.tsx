"use client";

import { useMemo, useState } from "react";
import { formatKstDateTime } from "@/lib/date-format";

export type ApplicationItem = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  applicantIntro: string;
  contact: string;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
  applicant: {
    id: string;
    email: string;
    name: string;
    school: string;
    grade: string;
  };
};

type Props = {
  projectId: string;
  questions: Array<string | null | undefined>;
  initialItems: ApplicationItem[];
};

function statusLabel(status: ApplicationItem["status"]) {
  if (status === "ACCEPTED") return "수락";
  if (status === "REJECTED") return "거절";
  return "대기";
}

export default function ApplicationsManager({ projectId, questions, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const active = useMemo(() => items.find((item) => item.id === activeId) ?? null, [items, activeId]);

  async function decide(appId: string, decision: "ACCEPTED" | "REJECTED") {
    setLoadingId(appId);
    try {
      const res = await fetch(`/api/me/projects/${projectId}/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = (await res.json()) as { error?: string; item?: { status: ApplicationItem["status"] } };
      if (!res.ok || !json.item) {
        throw new Error(json.error ?? "상태 변경 실패");
      }

      setItems((prev) => prev.map((item) => (item.id === appId ? { ...item, status: json.item!.status } : item)));
    } catch (error) {
      alert(error instanceof Error ? error.message : "상태 변경 실패");
    } finally {
      setLoadingId(null);
    }
  }

  async function removeApplicant(appId: string) {
    const ok = window.confirm("이 지원자를 프로젝트에서 탈퇴 처리할까요? (지원서/팀 정보가 제거됩니다)");
    if (!ok) return;

    setLoadingId(appId);
    try {
      const res = await fetch(`/api/me/projects/${projectId}/applications/${appId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "탈퇴 처리 실패");
      }
      setItems((prev) => prev.filter((item) => item.id !== appId));
      if (activeId === appId) {
        setActiveId(null);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "탈퇴 처리 실패");
    } finally {
      setLoadingId(null);
    }
  }

  if (!items.length) {
    return <p className="text-sm text-slate-400">아직 접수된 지원서가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-700/70">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-3 py-2">지원자</th>
              <th className="px-3 py-2">제출일</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">답변요약</th>
              <th className="px-3 py-2">액션</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-800/80 text-slate-200">
                <td className="px-3 py-2">
                  <p>{item.applicant.name}</p>
                  <p className="text-xs text-slate-400">{item.applicant.school} · {item.applicant.grade}</p>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatKstDateTime(item.createdAt)}</td>
                <td className="px-3 py-2">{statusLabel(item.status)}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{(item.answer1 || item.answer2 || item.answer3 || item.applicantIntro).slice(0, 40)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className="rounded-md border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
                    >
                      상세보기
                    </button>
                    <button
                      type="button"
                      disabled={loadingId === item.id || item.status !== "PENDING"}
                      onClick={() => decide(item.id, "ACCEPTED")}
                      className="rounded-md bg-emerald-500/90 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      수락
                    </button>
                    <button
                      type="button"
                      disabled={loadingId === item.id || item.status !== "PENDING"}
                      onClick={() => decide(item.id, "REJECTED")}
                      className="rounded-md bg-rose-500/90 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      거절
                    </button>
                    {item.status !== "PENDING" ? (
                      <span className="text-[11px] text-slate-400">처리 완료</span>
                    ) : null}
                    <button
                      type="button"
                      disabled={loadingId === item.id}
                      onClick={() => removeApplicant(item.id)}
                      className="rounded-md border border-rose-400/70 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      탈퇴
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active ? (
        <div className="rounded-xl border border-slate-700/80 bg-[color:var(--surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">지원서 상세 - {active.applicant.name}</h2>
            <button type="button" onClick={() => setActiveId(null)} className="text-xs text-slate-400 hover:text-slate-200">닫기</button>
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <p><span className="text-slate-400">자기소개:</span> {active.applicantIntro}</p>
            <p><span className="text-slate-400">연락수단:</span> {active.contact}</p>
            {questions.map((question, index) => {
              if (!question) return null;
              const answer = index === 0 ? active.answer1 : index === 1 ? active.answer2 : active.answer3;
              return (
                <div key={`${active.id}-${index}`} className="rounded-md border border-slate-700/80 p-3">
                  <p className="text-xs text-slate-400">질문 {index + 1}</p>
                  <p className="font-medium">{question}</p>
                  <p className="mt-1 text-slate-200">{answer || "(미입력)"}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
