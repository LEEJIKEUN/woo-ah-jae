"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS_BY_TAB, PRIMARY_TABS } from "@/lib/categoryConfig";

type Tab = (typeof PRIMARY_TABS)[number];

const INPUT_CLASS =
  "w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-400";

export default function ProjectCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("교과");
  const channels = useMemo(() => CHANNELS_BY_TAB[tab], [tab]);
  const [channel, setChannel] = useState(channels[0] ?? "국어");

  async function onUpload(file: File) {
    setThumbnailUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "이미지 업로드에 실패했습니다.");
      }
      setThumbnailUrl(json.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setThumbnailUploading(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setLoading(true);

        const form = new FormData(event.currentTarget);
        const payload = {
          title: String(form.get("title") || "").trim(),
          summary: String(form.get("summary") || "").trim(),
          description: String(form.get("description") || "").trim(),
          tab,
          channel,
          thumbnailUrl,
          capacity: Number(form.get("capacity") || 0),
          requirements: String(form.get("requirements") || "").trim(),
          rolesNeeded: String(form.get("rolesNeeded") || "").trim(),
          question1: String(form.get("question1") || "").trim(),
          question2: String(form.get("question2") || "").trim(),
          question3: String(form.get("question3") || "").trim(),
          deadline: form.get("deadline") ? new Date(String(form.get("deadline"))).toISOString() : undefined,
          status: "OPEN" as const,
        };

        try {
          if (!payload.title || !payload.summary || !payload.description) {
            throw new Error("제목/요약/설명은 필수입니다.");
          }

          if (!payload.question1 && !payload.question2 && !payload.question3) {
            throw new Error("지원 질문은 최소 1개 이상 입력해야 합니다.");
          }

          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const json = (await res.json()) as { item?: { id: string }; error?: string };
          if (!res.ok || !json.item) {
            throw new Error(json.error ?? "프로젝트 생성에 실패했습니다.");
          }

          router.push(`/projects/${json.item.id}`);
          router.refresh();
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "프로젝트 생성에 실패했습니다.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-slate-300">프로젝트 제목</span>
          <input name="title" required className={INPUT_CLASS} maxLength={120} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-slate-300">짧은 소개</span>
          <input name="summary" required className={INPUT_CLASS} maxLength={240} />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-sm text-slate-300">상세 설명</span>
        <textarea name="description" required rows={5} className={INPUT_CLASS} maxLength={8000} />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm text-slate-300">카테고리</span>
          <select
            className={INPUT_CLASS}
            value={tab}
            onChange={(event) => {
              const nextTab = event.target.value as Tab;
              setTab(nextTab);
              setChannel(CHANNELS_BY_TAB[nextTab][0] ?? "전체");
            }}
          >
            {PRIMARY_TABS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-300">하위 채널</span>
          <select className={INPUT_CLASS} value={channel} onChange={(event) => setChannel(event.target.value)}>
            {channels.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-300">모집 인원</span>
          <input name="capacity" required type="number" min={1} max={100} defaultValue={4} className={INPUT_CLASS} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 block">
          <span className="text-sm text-slate-300">조건</span>
          <textarea name="requirements" rows={3} className={INPUT_CLASS} maxLength={2000} placeholder="예: 주 2회 온라인 참여 가능" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm text-slate-300">모집 역할</span>
          <textarea name="rolesNeeded" rows={3} className={INPUT_CLASS} maxLength={2000} placeholder="예: 리서치 1명, 발표 1명" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-slate-300">마감일(선택)</span>
          <input name="deadline" type="date" className={INPUT_CLASS} />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm text-slate-300">썸네일 업로드</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={INPUT_CLASS}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
          <p className="text-xs text-slate-400">
            {thumbnailUploading
              ? "업로드 중..."
              : thumbnailUrl
                ? `업로드 완료: ${thumbnailUrl}`
                : "png/jpg/webp, 최대 10MB"}
          </p>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 block">
          <span className="text-sm text-slate-300">질문 1</span>
          <textarea name="question1" rows={3} className={INPUT_CLASS} maxLength={300} placeholder="지원자의 동기를 물어보세요" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm text-slate-300">질문 2</span>
          <textarea name="question2" rows={3} className={INPUT_CLASS} maxLength={300} placeholder="역할 경험을 물어보세요" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm text-slate-300">질문 3</span>
          <textarea name="question3" rows={3} className={INPUT_CLASS} maxLength={300} placeholder="시간 가능 여부를 물어보세요" />
        </label>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        disabled={loading || thumbnailUploading}
        className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-60"
      >
        {loading ? "생성 중..." : "프로젝트 생성"}
      </button>
    </form>
  );
}
