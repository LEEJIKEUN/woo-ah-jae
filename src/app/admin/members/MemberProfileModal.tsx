"use client";

import { useEffect, useState } from "react";
import { COURSES } from "@/lib/course/content";

type Profile = {
  id: string;
  email: string;
  role: string;
  roleLabel: string;
  createdAt: string;
  realName: string;
  schoolName: string;
  grade: string;
  residenceCountry: string;
  birthDate: string;
  assignedCourseIds: string[];
};

const EDITABLE = ["realName", "schoolName", "grade", "residenceCountry", "birthDate"] as const;
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "STUDENT", label: "학생" },
  { value: "FACILITATOR", label: "퍼실리테이터" },
  { value: "PARENT", label: "학부모" },
  { value: "ADMIN", label: "관리자" },
];

/** 관리자: 회원 이름 클릭 → 프로필 조회·수정(권한·담당강좌 포함) 모달 */
export default function MemberProfileModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved?: () => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [role, setRole] = useState("STUDENT");
  const [courseIds, setCourseIds] = useState<Set<string>>(new Set());
  const [assignable, setAssignable] = useState<{ id: string; title: string }[]>(COURSES.map((c) => ({ id: c.id, title: c.title })));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/members/${id}/profile`, { cache: "no-store" });
        const d = (await res.json()) as Profile & { error?: string };
        if (!alive) return;
        if (!res.ok) {
          setErr(d.error ?? "프로필을 불러오지 못했습니다.");
          return;
        }
        setP(d);
        setForm(Object.fromEntries(EDITABLE.map((k) => [k, (d as unknown as Record<string, string>)[k] ?? ""])));
        setRole(d.role);
        setCourseIds(new Set(d.assignedCourseIds ?? []));
        // 배정 가능한 전체 강좌(하드코딩 + DB)
        fetch("/api/admin/courses/assignable", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { courses: [] }))
          .then((cd) => { if (alive && Array.isArray(cd.courses) && cd.courses.length) setAssignable(cd.courses); })
          .catch(() => {});
      } catch {
        if (alive) setErr("네트워크 오류가 발생했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  function toggleCourse(cid: string) {
    setCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/members/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role, courseIds: [...courseIds] }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(d.error ?? "저장에 실패했습니다.");
        return;
      }
      setMsg("저장되었습니다.");
      onSaved?.();
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputCls = "h-9 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900";
  const roCls = "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[560px] flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">회원 프로필</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="닫기">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-slate-500">불러오는 중…</p>
          ) : p ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1"><span className="text-xs text-slate-500">이름(실명) *</span><input className={inputCls} value={form.realName ?? ""} onChange={set("realName")} /></label>
              <div className="space-y-1"><span className="text-xs text-slate-500">이메일</span><div className={roCls}>{p.email}</div></div>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">권한 (본인 권한은 변경 불가)</span>
                <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label className="space-y-1"><span className="text-xs text-slate-500">학교</span><input className={inputCls} value={form.schoolName ?? ""} onChange={set("schoolName")} /></label>
              <label className="space-y-1"><span className="text-xs text-slate-500">졸업예정연도</span><input className={inputCls} value={form.grade ?? ""} onChange={set("grade")} /></label>
              <label className="space-y-1"><span className="text-xs text-slate-500">거주 국가</span><input className={inputCls} value={form.residenceCountry ?? ""} onChange={set("residenceCountry")} /></label>
              <label className="space-y-1"><span className="text-xs text-slate-500">생년월일</span><input type="date" className={inputCls} value={form.birthDate ?? ""} onChange={set("birthDate")} /></label>

              {role === "FACILITATOR" ? (
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-slate-500">담당 강좌 (관리자가 배정)</span>
                  <div className="space-y-1 rounded-md border border-slate-200 p-2">
                    {assignable.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-800 hover:bg-slate-50">
                        <input type="checkbox" checked={courseIds.has(c.id)} onChange={() => toggleCourse(c.id)} />
                        <span className="truncate">{c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className={`${roCls} sm:col-span-2`}>가입일: {new Date(p.createdAt).toLocaleString("ko-KR", { hour12: false })}</div>
            </div>
          ) : null}
          {err ? <p className="mt-3 text-sm text-rose-600">{err}</p> : null}
          {msg ? <p className="mt-3 text-sm text-emerald-600">{msg}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">닫기</button>
          <button type="button" onClick={() => void save()} disabled={saving || loading || !p} className="rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중…" : "저장"}</button>
        </div>
      </div>
    </div>
  );
}
