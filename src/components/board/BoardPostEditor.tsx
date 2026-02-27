"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BOARD_CATEGORY_TAGS } from "@/lib/board-config";

type AttachmentItem = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

type Props = {
  channelSlug: string;
  mode: "create" | "edit";
  postId?: string;
  initial?: {
    categoryTag?: string | null;
    title?: string;
    content?: string;
    attachments?: AttachmentItem[];
    isNotice?: boolean;
    isPinned?: boolean;
    status?: "ACTIVE" | "HIDDEN" | "DELETED";
  };
  isAdmin: boolean;
};

export default function BoardPostEditor({ channelSlug, mode, postId, initial, isAdmin }: Props) {
  const router = useRouter();
  const [categoryTag, setCategoryTag] = useState(initial?.categoryTag ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initial?.attachments ?? []);
  const [isNotice, setIsNotice] = useState(!!initial?.isNotice);
  const [isPinned, setIsPinned] = useState(!!initial?.isPinned);
  const [status, setStatus] = useState<"ACTIVE" | "HIDDEN" | "DELETED">(initial?.status ?? "ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    let images = 0;
    let files = 0;
    attachments.forEach((a) => {
      if (a.mimeType.startsWith("image/")) images += 1;
      else files += 1;
    });
    return { images, files };
  }, [attachments]);

  async function onUploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: AttachmentItem[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/boards/upload?slug=${encodeURIComponent(channelSlug)}`, {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as { error?: string; fileUrl?: string; fileName?: string; mimeType?: string; size?: number };
        if (!res.ok || !json.fileUrl || !json.fileName || !json.mimeType || !json.size) {
          throw new Error(json.error ?? "첨부 업로드 실패");
        }
        uploaded.push({
          url: json.fileUrl,
          name: json.fileName,
          mimeType: json.mimeType,
          size: json.size,
        });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "첨부 업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        categoryTag: categoryTag || null,
        title,
        content,
        attachments,
        ...(isAdmin ? { isNotice, isPinned, status } : {}),
      };
      const endpoint = mode === "create" ? `/api/boards/${channelSlug}/posts` : `/api/board-posts/${postId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; item?: { id: string } };
      if (!res.ok) throw new Error(json.error ?? "저장 실패");

      if (mode === "create") {
        const id = json.item?.id;
        router.push(id ? `/boards/posts/${id}` : `/boards/${channelSlug}`);
      } else {
        router.push(`/boards/posts/${postId}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-slate-300">말머리</span>
          <select
            value={categoryTag}
            onChange={(e) => setCategoryTag(e.target.value)}
            className="h-10 w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 text-sm text-slate-100"
          >
            <option value="">선택 안함</option>
            {BOARD_CATEGORY_TAGS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 text-sm text-slate-100"
          maxLength={160}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">내용</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          className="w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-100"
          maxLength={12000}
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm text-slate-300">첨부파일 (이미지 최대 5개 / 일반 파일 최대 3개)</p>
        <label className="inline-flex cursor-pointer rounded-md border border-slate-500/80 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-slate-300">
          {uploading ? "업로드 중..." : "파일 선택"}
          <input type="file" className="hidden" multiple onChange={(e) => void onUploadFiles(e.target.files)} />
        </label>
        <p className="text-xs text-slate-400">
          현재 이미지 {counts.images}개 / 일반 파일 {counts.files}개
        </p>
        <ul className="space-y-1 text-xs text-slate-300">
          {attachments.map((a, index) => (
            <li key={`${a.url}-${index}`} className="flex items-center justify-between rounded border border-slate-700/70 px-2 py-1">
              <a href={a.url} target="_blank" rel="noreferrer" className="truncate hover:text-white">
                {a.name}
              </a>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                className="ml-2 text-rose-300 hover:text-rose-200"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </div>

      {isAdmin ? (
        <div className="grid gap-3 rounded-md border border-slate-700/70 p-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={isNotice} onChange={(e) => setIsNotice(e.target.checked)} />
            공지글
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
            상단고정
          </label>
          <label className="space-y-1 text-sm text-slate-300">
            상태
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "ACTIVE" | "HIDDEN" | "DELETED")}
              className="h-9 w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-2 text-sm text-slate-100"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="HIDDEN">HIDDEN</option>
              <option value="DELETED">DELETED</option>
            </select>
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || uploading || !title.trim() || !content.trim()}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
        >
          {submitting ? "저장 중..." : mode === "create" ? "게시글 등록" : "수정 저장"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-slate-500 px-4 py-2 text-sm text-slate-100">
          취소
        </button>
      </div>
    </section>
  );
}
