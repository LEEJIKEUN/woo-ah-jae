"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { newId } from "@/lib/course/store";

const BROWN = "#8C6E59";
const NUM = "#B58F72";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type FormLesson = { id: string; title: string; kind: "material" | "assignment"; body: string };
type FormModule = { id: string; label: string; lessons: FormLesson[] };

const blankLesson = (): FormLesson => ({ id: newId("l"), title: "", kind: "material", body: "" });
const blankModule = (label = ""): FormModule => ({ id: newId("m"), label, lessons: [blankLesson()] });

export type CourseInitial = {
  slug: string;
  title: string; subtitle: string; programme: string; audience: string; format: string; deliveryMode: string; periodLabel: string; country: string; summary: string;
  modules: { label: string; lessons: { title: string; kind: string; body: string }[] }[];
};

export default function CourseCreateForm({ initial, editSlug }: { initial?: CourseInitial; editSlug?: string } = {}) {
  const router = useRouter();
  const isEdit = !!editSlug;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [programme, setProgramme] = useState(initial?.programme ?? "");
  const [audience, setAudience] = useState(initial?.audience ?? "고등학생");
  const [format, setFormat] = useState(initial?.format ?? "자기주도학습");
  const [deliveryMode, setDeliveryMode] = useState(initial?.deliveryMode ?? "온라인");
  const [periodLabel, setPeriodLabel] = useState(initial?.periodLabel ?? "");
  const [country, setCountry] = useState(initial?.country ?? "한국");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [modules, setModules] = useState<FormModule[]>(
    initial?.modules?.length
      ? initial.modules.map((m) => ({ id: newId("m"), label: m.label, lessons: m.lessons.length ? m.lessons.map((l) => ({ id: newId("l"), title: l.title, kind: l.kind === "assignment" ? "assignment" : "material", body: l.body })) : [blankLesson()] }))
      : [blankModule("오리엔테이션")]
  );

  function patchModule(mi: number, patch: Partial<FormModule>) {
    setModules((prev) => prev.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  }
  function patchLesson(mi: number, li: number, patch: Partial<FormLesson>) {
    setModules((prev) =>
      prev.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.map((l, j) => (j === li ? { ...l, ...patch } : l)) } : m))
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      alert("과목명을 입력하세요.");
      return;
    }
    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      programme: programme.trim() || "우아재 강좌",
      audience,
      format,
      deliveryMode,
      periodLabel: periodLabel.trim(),
      country,
      summary: summary.trim(),
      status: "prep",
      modules: modules
        .map((m) => ({
          label: m.label.trim(),
          lessons: m.lessons
            .map((l) => ({ title: l.title.trim(), kind: l.kind, scheduleLabel: "", body: l.body.trim() }))
            .filter((l) => l.title),
        }))
        .filter((m) => m.label),
    };
    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/courses/${editSlug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const d = (await res.json()) as { error?: string };
        if (!res.ok) { alert(d.error ?? "저장에 실패했습니다."); return; }
        router.push(`/course/${editSlug}`);
        return;
      }
      const res = await fetch("/api/admin/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok || !d.slug) {
        alert(d.error ?? "강좌 개설에 실패했습니다.");
        return;
      }
      router.push(`/course/${d.slug}`);
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  }

  async function removeCourse() {
    if (!editSlug || !confirm("이 강좌를 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      const res = await fetch(`/api/admin/courses/${editSlug}`, { method: "DELETE" });
      if (res.ok) router.push("/");
      else alert("삭제에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  }

  return (
    <div style={{ background: "#fff", color: BODY }}>
      <form onSubmit={submit} className="mx-auto max-w-[820px] px-6 pt-20 pb-32">
        <p className="text-center text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.24em", color: NUM }}>{isEdit ? "EDIT COURSE" : "NEW COURSE"}</p>
        <h1 className="mt-4 text-center text-[30px] font-normal md:text-[38px]" style={{ ...serif, color: INK, letterSpacing: "-0.03em" }}>{isEdit ? "강좌 수정" : "강좌 개설"}</h1>
        <p className="mt-3 text-center text-[14px]" style={{ color: SUB }}>과목·소개·커리큘럼·강의 콘텐츠까지 직접 입력해 강좌를 엽니다.</p>

        {/* 기본 정보 */}
        <div className="mt-14 space-y-8">
          <Field label="과목명" required>
            <Input value={title} onChange={setTitle} placeholder="예: 인공지능을 위한 선형대수학" />
          </Field>
          <Field label="부제">
            <Input value={subtitle} onChange={setSubtitle} placeholder="예: AI를 떠받치는 수학 — 벡터에서 신경망까지" />
          </Field>
          <Field label="분류 / 프로그램">
            <Input value={programme} onChange={setProgramme} placeholder="예: 2022개정 교육과정 교육감 승인 과목" />
          </Field>
          <div className="grid gap-8 md:grid-cols-2">
            <Field label="대상"><Select value={audience} onChange={setAudience} options={["초등학생", "중학생", "고등학생", "학부모"]} /></Field>
            <Field label="형식"><Select value={format} onChange={setFormat} options={[
              { value: "자기주도학습", label: "SELF 자기주도학습" },
              { value: "관리형학습", label: "CARE 관리형학습" },
              { value: "실시간수업", label: "LIVE 실시간수업" },
              { value: "세미나", label: "SEMINAR 세미나" },
            ]} /></Field>
            <Field label="방식"><Select value={deliveryMode} onChange={setDeliveryMode} options={["온라인", "오프라인"]} /></Field>
            <Field label="국가"><Select value={country} onChange={setCountry} options={["한국", "호치민", "하노이", "상해", "북경", "자카르타", "싱가포르"]} /></Field>
          </div>
          <Field label="기간">
            <Input value={periodLabel} onChange={setPeriodLabel} placeholder="예: 2026.8.17.(월) ~ 2026.11.4.(수)" />
          </Field>
          <Field label="강좌 소개">
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={6} placeholder="강좌의 목표, 다루는 내용, 이런 분께 추천 등을 자유롭게 적어주세요."
              className="w-full rounded-[10px] border px-4 py-3 text-[15px] leading-7 outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK }} />
          </Field>
        </div>

        {/* 커리큘럼 + 강의 콘텐츠 */}
        <div className="mt-16">
          <h2 className="text-[20px]" style={{ ...serif, color: INK }}>커리큘럼 · 강의</h2>
          <p className="mt-1.5 text-[13px]" style={{ color: SUB }}>모듈(차시) 안에 강의자료·과제를 넣어 구성합니다.</p>

          <div className="mt-6 space-y-5">
            {modules.map((m, mi) => (
              <div key={m.id} className="rounded-[14px] p-5" style={{ background: PANEL }}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px]" style={{ color: NUM }}>{String(mi + 1).padStart(2, "0")}</span>
                  <input value={m.label} onChange={(e) => patchModule(mi, { label: e.target.value })} placeholder="모듈명 (예: Module 1 · 벡터와 행렬)"
                    className="flex-1 rounded-[8px] border bg-white px-3 text-[15px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK, height: 42, ...serif }} />
                  {modules.length > 1 ? (
                    <button type="button" onClick={() => setModules((prev) => prev.filter((_, i) => i !== mi))} aria-label="모듈 삭제" style={{ color: SUB }}><X size={17} /></button>
                  ) : null}
                </div>

                {/* 강의(레슨) */}
                <div className="mt-4 space-y-3 pl-6">
                  {m.lessons.map((l, li) => (
                    <div key={l.id} className="rounded-[10px] border bg-white p-3.5" style={{ borderColor: LINE }}>
                      <div className="flex items-center gap-2">
                        <select value={l.kind} onChange={(e) => patchLesson(mi, li, { kind: e.target.value as FormLesson["kind"] })}
                          className="rounded-[8px] border bg-white px-2 text-[13px] outline-none" style={{ borderColor: LINE, color: INK, height: 38 }}>
                          <option value="material">강의자료</option>
                          <option value="assignment">과제</option>
                        </select>
                        <input value={l.title} onChange={(e) => patchLesson(mi, li, { title: e.target.value })} placeholder="강의 제목"
                          className="flex-1 rounded-[8px] border bg-white px-3 text-[14px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK, height: 38 }} />
                        {m.lessons.length > 1 ? (
                          <button type="button" onClick={() => patchModule(mi, { lessons: m.lessons.filter((_, j) => j !== li) })} aria-label="강의 삭제" style={{ color: SUB }}><X size={15} /></button>
                        ) : null}
                      </div>
                      <textarea value={l.body} onChange={(e) => patchLesson(mi, li, { body: e.target.value })} rows={3}
                        placeholder={l.kind === "assignment" ? "과제 설명 / 제출 안내" : "강의 내용 · 자료 설명"}
                        className="mt-2.5 w-full rounded-[8px] border px-3 py-2 text-[14px] leading-6 outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK }} />
                    </div>
                  ))}
                  <button type="button" onClick={() => patchModule(mi, { lessons: [...m.lessons, blankLesson()] })} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: BROWN }}>
                    <Plus size={14} /> 강의 추가
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setModules((prev) => [...prev, blankModule()])} className="inline-flex items-center gap-1.5 text-[14px]" style={{ color: BROWN }}>
              <Plus size={15} /> 모듈 추가
            </button>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => router.push(isEdit ? `/course/${editSlug}` : "/")} className="rounded-[8px] border px-8 py-3 text-[15px]" style={{ borderColor: LINE, color: SUB, ...serif }}>취소</button>
          <button type="submit" className="rounded-[8px] px-10 py-3 text-[15px] text-white" style={{ background: BROWN, ...serif, boxShadow: "0 2px 10px rgba(140,110,89,0.25)" }}>{isEdit ? "저장하기" : "강좌 개설하기"}</button>
          {isEdit ? (
            <button type="button" onClick={removeCourse} className="rounded-[8px] border px-6 py-3 text-[15px]" style={{ borderColor: "#E6C4C4", color: "#B4544B", ...serif }}>강좌 삭제</button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[15px]" style={{ ...serif, color: INK }}>
        {label}
        {required ? <span style={{ color: "#a6402c" }}> *</span> : null}
      </span>
      <div className="mt-2.5">{children}</div>
    </label>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-[10px] border px-4 text-[15px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK, height: 46 }} />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<string | { value: string; label: string }> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[10px] border px-3 text-[15px] outline-none" style={{ borderColor: LINE, color: INK, height: 46 }}>
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  );
}
