"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Folder, Download, ChevronDown, ChevronLeft, ChevronRight, Clock, PlayCircle, MessageSquare } from "lucide-react";
import type { Activity, Course, Module } from "@/lib/course/content";
import { BC, IB } from "@/lib/course/theme";
import DoneBadge from "@/components/course/DoneBadge";
import { useCompletion } from "@/components/course/completion";

export default function ActivityView({
  course,
  module,
  activity,
}: {
  course: Course;
  module: Module;
  activity: Activity;
}) {
  const { toggle } = useCompletion();

  // 열람 시 자동 완료
  useEffect(() => {
    if (activity.completion === "auto") toggle(activity.id, true);
  }, [activity.id, activity.completion, toggle]);

  return (
    <div>
      {/* 라이트 헤더 */}
      <div className="mb-6 border-b pb-5" style={{ borderColor: BC.borderCard }}>
        <Link
          href={`/course/${course.id}/learn`}
          className="mb-2 inline-flex items-center gap-1 text-[13px] font-bold"
          style={{ color: BC.accentInk }}
        >
          <ChevronLeft size={14} /> 강의실
        </Link>
        <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px]" style={{ color: BC.meta }}>
          <Link href={`/course/${course.id}`} className="hover:underline" style={{ color: BC.meta }}>
            {course.title}
          </Link>
          <ChevronRight size={12} />
          <span>{module.label}</span>
        </nav>
        <h1 className="mt-2 text-[24px] font-semibold md:text-[28px]" style={{ color: BC.ink, fontFamily: "var(--font-serif)" }}>
          {activity.title}
        </h1>
        {activity.scheduleLabel ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: BC.meta }}>
            <Clock size={13} /> {activity.scheduleLabel}
            {activity.durationMin ? ` · ${activity.durationMin}분` : ""}
          </p>
        ) : null}
      </div>

      {/* 완료 조건 바 */}
      {activity.completion !== "none" ? (
        <div
          className="mb-6 flex items-center justify-between gap-3 rounded-[4px] border px-4 py-2.5"
          style={{ borderColor: BC.borderCard, background: "#F5F0E4" }}
        >
          <span className="text-[13px]" style={{ color: BC.sub }}>
            완료 조건: {activity.completion === "auto" ? "이 활동을 열람하면 자동 완료됩니다" : "아래를 마친 뒤 완료로 표시하세요"}
          </span>
          <DoneBadge activityId={activity.id} mode={activity.completion} />
        </div>
      ) : null}

      {activity.kind === "resource" || activity.kind === "page" ? (
        <ResourceBody activity={activity} course={course} module={module} />
      ) : null}
      {activity.kind === "folder" ? <FolderBody activity={activity} /> : null}
      {activity.kind === "assignment" ? <AssignmentBody activity={activity} /> : null}
      {activity.kind === "forum" ? <ForumBody activity={activity} /> : null}
    </div>
  );
}

// ── 자료/페이지 ─────────────────────────────────────────
function ResourceBody({ activity, course, module }: { activity: Activity; course: Course; module: Module }) {
  const materials = activity.materials ?? [];
  const online = activity.onlineResources ?? [];
  return (
    <div>
      {activity.body?.map((p, i) => (
        <p key={i} className="mb-4 text-[15px] leading-7" style={{ color: BC.sub }}>
          {p}
        </p>
      ))}

      {/* 강의자료(다운로드) + 온라인 자료 */}
      {materials.length > 0 || online.length > 0 ? (
        <div className="mt-6 rounded-[6px] border" style={{ borderColor: BC.borderCard }}>
          <p className="border-b px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: BC.borderCard, color: BC.ink, background: "#FAF7EF" }}>
            강의자료
          </p>
          <ul className="divide-y" style={{ borderColor: BC.borderCard }}>
            {materials.map((f) => (
              <li key={f.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <FileText size={16} style={{ color: "#B84A4A" }} />
                <a href={f.href ?? "#"} target="_blank" rel="noopener noreferrer" download className="flex-1 truncate text-[14px] hover:underline" style={{ color: BC.accentInk }}>
                  {f.name}
                </a>
                {f.sizeLabel ? <span className="text-[12px]" style={{ color: BC.meta }}>{f.sizeLabel}</span> : null}
                <Download size={15} style={{ color: BC.meta }} />
              </li>
            ))}
            {online.map((r, i) => (
              <li key={`o-${i}`} className="flex items-center gap-2.5 px-4 py-2.5">
                <PlayCircle size={16} style={{ color: BC.accentInk }} />
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-[14px] hover:underline" style={{ color: BC.accentInk }}>
                  {r.label}
                </a>
                <span className="text-[12px]" style={{ color: BC.meta }}>바로가기</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activity.cards && activity.cards.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-lg" style={{ background: "#2C2823" }}>
          <div className="px-5 py-4 text-white">
            <p className="text-[12px] uppercase tracking-wide text-white/60">{course.title}</p>
            <p className="text-[18px] font-semibold">{module.label}</p>
          </div>
          <div className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
            {activity.cards.map((card, i) => (
              <div key={i} className="overflow-hidden rounded-md bg-white">
                <div
                  className="h-24"
                  style={{
                    background:
                      card.accent === "navy"
                        ? `linear-gradient(135deg, ${BC.accentInk}, #5F4A3A)`
                        : `linear-gradient(135deg, #A98B6E, #6B5342)`,
                  }}
                />
                <div className="p-4">
                  <h4 className="text-[15px] font-semibold" style={{ color: BC.accentInk }}>
                    {card.title}
                  </h4>
                  <p className="mt-1 text-[13px] leading-5" style={{ color: BC.meta }}>
                    {card.desc}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-[12px]" style={{ color: BC.meta }}>
                    <Clock size={12} /> 소요 {card.durationMin}분
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: "#E4DBC7" }} />
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[13px] font-semibold text-white"
                    style={{ background: BC.accentInk }}
                  >
                    <PlayCircle size={14} /> 학습하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── 폴더(자료실) ────────────────────────────────────────
function FolderBody({ activity }: { activity: Activity }) {
  const groups = (activity.materials ?? []).reduce<Record<string, typeof activity.materials>>((acc, m) => {
    const key = m.group ?? "기타";
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div>
      {activity.onlineResources && activity.onlineResources.length > 0 ? (
        <div className="mb-5 rounded-[4px] border px-4 py-3" style={{ borderColor: BC.borderCard, background: "#F5F0E4" }}>
          <p className="mb-2 text-[13px] font-bold" style={{ color: BC.ink }}>
            온라인 자료
          </p>
          <ul className="space-y-1">
            {activity.onlineResources.map((r, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[14px]">
                <span style={{ color: BC.meta }}>•</span>
                <a href={r.href} className="hover:underline" style={{ color: BC.accentInk }}>
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[13px] font-semibold text-white"
          style={{ background: "#8A6A46" }}
        >
          <Download size={15} /> 폴더 다운로드
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(groups).map(([group, files]) => (
          <div key={group}>
            <p className="mb-1.5 flex items-center gap-2 text-[14px] font-bold" style={{ color: BC.ink }}>
              <ChevronDown size={14} />
              <Folder size={15} style={{ color: "#E0A65A" }} />
              {group}
            </p>
            <ul className="ml-6 space-y-1.5 border-l pl-4" style={{ borderColor: BC.borderCard }}>
              {(files ?? []).map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-[14px]">
                  <FileText size={15} style={{ color: "#B84A4A" }} />
                  <a href={f.href ?? "#"} className="hover:underline" style={{ color: BC.accentInk }}>
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 과제(제출·피드백) ───────────────────────────────────
function AssignmentBody({ activity }: { activity: Activity }) {
  const a = activity.assignment!;
  const { toggle } = useCompletion();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  function submit() {
    if (a.allowText && !text.trim() && !fileName) {
      alert("답안 텍스트 또는 첨부파일을 입력해 주세요.");
      return;
    }
    setSubmittedAt(new Date().toLocaleString("ko-KR"));
    toggle(activity.id, true);
  }

  return (
    <div>
      {/* 과제 설명 */}
      <div className="rounded-[4px] border px-4 py-4" style={{ borderColor: BC.borderCard, background: "#F5F0E4" }}>
        <p className="text-[15px] leading-7" style={{ color: BC.sub }}>
          {a.prompt}
        </p>
        <ul className="mt-3 space-y-1.5">
          {a.instructions.map((ins, i) => (
            <li key={i} className="text-[14px] leading-6" style={{ color: BC.sub }}>
              {ins}
            </li>
          ))}
        </ul>
        {a.dueLabel ? (
          <p className="mt-3 text-[13px] font-medium" style={{ color: IB.warnText }}>
            마감: {a.dueLabel}
          </p>
        ) : null}
      </div>

      {/* 제출 상태 */}
      {submittedAt ? (
        <div className="mt-5 overflow-hidden rounded-[4px] border" style={{ borderColor: BC.borderCard }}>
          <table className="w-full text-[14px]">
            <tbody>
              <Row label="제출 상태" value={<span style={{ color: BC.accentInk, fontWeight: 700 }}>제출 완료</span>} />
              <Row label="제출 시각" value={submittedAt} />
              {text.trim() ? <Row label="제출 답안" value={<span className="whitespace-pre-wrap">{text.trim()}</span>} /> : null}
              {fileName ? <Row label="첨부파일" value={fileName} /> : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-[4px] border p-4" style={{ borderColor: BC.borderCard }}>
          <h4 className="text-[15px] font-bold" style={{ color: BC.ink }}>
            과제 제출
          </h4>
          {a.allowText ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="답안을 작성하세요."
              className="mt-3 w-full rounded-[4px] border px-3 py-2 text-[14px] outline-none"
              style={{ borderColor: BC.borderCard, color: BC.ink }}
            />
          ) : null}
          {a.allowFile ? (
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-[4px] border px-3 py-2 text-[13px]" style={{ borderColor: BC.borderCard, color: BC.sub }}>
              {fileName ?? "파일 첨부"}
              <input type="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
            </label>
          ) : null}
          <div className="mt-4">
            <button
              type="button"
              onClick={submit}
              className="rounded-[4px] px-4 py-2 text-[14px] font-bold text-white"
              style={{ background: BC.accentInk }}
            >
              제출하기
            </button>
          </div>
        </div>
      )}

      {/* 피드백 (제출 후) */}
      {submittedAt && a.feedbackSample ? (
        <div className="mt-5 rounded-[4px] border-l-4 bg-white p-4" style={{ borderColor: BC.accent }}>
          <div className="flex items-center justify-between">
            <h4 className="text-[15px] font-bold" style={{ color: BC.ink }}>
              담당자 피드백
            </h4>
            {a.feedbackSample.grade ? (
              <span className="rounded-[4px] px-2.5 py-1 text-[12px] font-bold" style={{ background: "#E6EEE7", color: BC.accentInk }}>
                평가: {a.feedbackSample.grade}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[14px] leading-6" style={{ color: BC.sub }}>
            {a.feedbackSample.comment}
          </p>
          <p className="mt-2 text-[12px]" style={{ color: BC.meta }}>
            — {a.feedbackSample.by}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-b last:border-b-0" style={{ borderColor: BC.borderCard }}>
      <th className="w-32 px-4 py-2.5 text-left align-top text-[13px] font-bold" style={{ background: "#FAFAFA", color: BC.meta }}>
        {label}
      </th>
      <td className="px-4 py-2.5 align-top" style={{ color: BC.sub }}>
        {value}
      </td>
    </tr>
  );
}

// ── 포럼(토론) ─────────────────────────────────────────
function ForumBody({ activity }: { activity: Activity }) {
  const [posts, setPosts] = useState<Array<{ author: string; body: string; at: string }>>([
    { author: "박하은", body: "이미지도 결국 픽셀 값의 행렬이라, 선형대수가 데이터 표현의 공통 언어라고 생각합니다.", at: "2일 전" },
    { author: "정민서", body: "추천 시스템에서 사용자–아이템 행렬을 다루는 것도 같은 맥락 같아요.", at: "1일 전" },
  ]);
  const [draft, setDraft] = useState("");

  return (
    <div>
      {activity.body?.map((p, i) => (
        <p key={i} className="mb-4 text-[15px] leading-7" style={{ color: BC.sub }}>
          {p}
        </p>
      ))}

      <div className="mb-4 flex items-center gap-2 text-[13px]" style={{ color: BC.meta }}>
        <MessageSquare size={15} /> 게시글 {activity.forumMeta?.posts ?? posts.length}개
      </div>

      <div className="space-y-3">
        {posts.map((post, i) => (
          <article key={i} className="rounded-[4px] border p-3.5" style={{ borderColor: BC.borderCard }}>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: BC.accentInk }}>
                {post.author.slice(0, 1)}
              </span>
              <span className="text-[13px] font-bold" style={{ color: BC.ink }}>
                {post.author}
              </span>
              <span className="text-[12px]" style={{ color: BC.meta }}>
                · {post.at}
              </span>
            </div>
            <p className="mt-2 text-[14px] leading-6" style={{ color: BC.sub }}>
              {post.body}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-[4px] border p-3.5" style={{ borderColor: BC.borderCard }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="토론에 참여해 보세요."
          className="w-full rounded-[4px] border px-3 py-2 text-[14px] outline-none"
          style={{ borderColor: BC.borderCard, color: BC.ink }}
        />
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={() => {
              if (!draft.trim()) return;
              setPosts((prev) => [...prev, { author: "나", body: draft.trim(), at: "방금" }]);
              setDraft("");
            }}
            className="rounded-[4px] px-3.5 py-1.5 text-[13px] font-bold text-white"
            style={{ background: BC.accentInk }}
          >
            게시
          </button>
        </div>
      </div>
    </div>
  );
}
