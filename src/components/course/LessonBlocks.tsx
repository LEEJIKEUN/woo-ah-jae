"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Paperclip, Link2, Type, Heading, Minus, Download, Pencil, X, Video } from "lucide-react";

/* 우아재 서재 톤 */
const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Block =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "file"; name: string; size: number; dataUrl: string }
  | { id: string; type: "video"; name: string; size: number; videoKey?: string }
  | { id: string; type: "link"; title: string; url: string; desc: string }
  | { id: string; type: "divider" };

/** 강의 동영상 업로드 — presign 받아 브라우저에서 R2 로 직접 PUT(진행률 콜백). */
async function uploadVideo(courseId: string, activityId: string, file: File, onProgress: (pct: number) => void): Promise<{ name: string; size: number; videoKey: string }> {
  const res = await fetch(`/api/courses/${courseId}/lessons/${activityId}/video/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }),
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error ?? "업로드 준비에 실패했습니다.");
  }
  const { url, key } = (await res.json()) as { url: string; key: string };
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`업로드 실패 (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("네트워크 오류(업로드). R2 CORS 설정을 확인하세요."));
    xhr.send(file);
  });
  return { name: file.name, size: file.size, videoKey: key };
}

const MAX_FILE_BYTES = 6 * 1024 * 1024;
function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `b_${Math.random().toString(36).slice(2)}`;
  }
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function download(name: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function LessonBlocks({ courseId, activityId, isAdmin }: { courseId: string; activityId: string; isAdmin: boolean }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/lessons/${activityId}/content`, { cache: "no-store" });
        const data = (await res.json()) as { blocks?: Block[] };
        if (alive) setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      } catch {
        /* 무시 */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId, activityId]);

  function startEdit() {
    setDraft(blocks.map((b) => ({ ...b })));
    setError(null);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setDraft([]);
    setError(null);
  }
  async function saveEdit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons/${activityId}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: draft }),
      });
      const data = (await res.json()) as { blocks?: Block[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setBlocks(Array.isArray(data.blocks) ? data.blocks : draft);
      setEditing(false);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function addBlock(type: Block["type"]) {
    const base: Block =
      type === "heading" ? { id: newId(), type: "heading", text: "" }
      : type === "text" ? { id: newId(), type: "text", text: "" }
      : type === "file" ? { id: newId(), type: "file", name: "", size: 0, dataUrl: "" }
      : type === "video" ? { id: newId(), type: "video", name: "", size: 0 }
      : type === "link" ? { id: newId(), type: "link", title: "", url: "", desc: "" }
      : { id: newId(), type: "divider" };
    setDraft((d) => [...d, base]);
  }
  function patch(id: string, p: Partial<Block>) {
    setDraft((d) => d.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b)));
  }
  function remove(id: string) {
    setDraft((d) => d.filter((b) => b.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const i = d.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function onPickFile(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError(`파일이 너무 큽니다. (최대 ${fmtSize(MAX_FILE_BYTES)})`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch(id, { name: f.name, size: f.size, dataUrl: String(reader.result) } as Partial<Block>);
    reader.readAsDataURL(f);
  }

  if (!ready) return null;
  // 학생이면서 콘텐츠가 없으면 아무것도 표시하지 않음
  if (!isAdmin && blocks.length === 0) return null;

  const list = editing ? draft : blocks;

  return (
    <div className="mt-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[20px] font-bold" style={{ ...serif, color: INK }}>학습 콘텐츠</h2>
        {isAdmin ? (
          editing ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: SUB }}>
                <X size={14} /> 취소
              </button>
              <button type="button" onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1 rounded-[8px] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: BROWN }}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-[8px] border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: BROWN, color: BROWN }}>
              <Pencil size={14} /> 콘텐츠 편집
            </button>
          )
        ) : null}
      </div>

      {error ? <p className="mb-3 rounded-[8px] px-3 py-2 text-[13px]" style={{ background: "#fbeae7", color: "#a6402c" }}>{error}</p> : null}

      {/* 본문(뷰/편집) */}
      {list.length === 0 && !editing ? (
        <p className="py-6 text-[14px]" style={{ color: SUB }}>{isAdmin ? "‘콘텐츠 편집’으로 제목·텍스트·파일·링크를 추가하세요." : "등록된 콘텐츠가 없습니다."}</p>
      ) : (
        <div className="space-y-4">
          {list.map((b) => (editing ? (
            <BlockEditor key={b.id} courseId={courseId} activityId={activityId} block={b} onPatch={(p) => patch(b.id, p)} onRemove={() => remove(b.id)} onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} onFile={(e) => onPickFile(b.id, e)} />
          ) : (
            <BlockView key={b.id} courseId={courseId} activityId={activityId} block={b} />
          )))}
        </div>
      )}

      {/* 블록 추가 */}
      {editing ? (
        <div className="mt-5 flex flex-wrap gap-2 rounded-[10px] border border-dashed p-3" style={{ borderColor: LINE }}>
          <span className="mr-1 self-center text-[12px] font-semibold" style={{ color: SUB }}>블록 추가</span>
          <AddBtn onClick={() => addBlock("heading")} icon={<Heading size={14} />} label="제목" />
          <AddBtn onClick={() => addBlock("text")} icon={<Type size={14} />} label="텍스트" />
          <AddBtn onClick={() => addBlock("file")} icon={<Paperclip size={14} />} label="파일" />
          <AddBtn onClick={() => addBlock("video")} icon={<Video size={14} />} label="동영상" />
          <AddBtn onClick={() => addBlock("link")} icon={<Link2 size={14} />} label="링크" />
          <AddBtn onClick={() => addBlock("divider")} icon={<Minus size={14} />} label="구분선" />
        </div>
      ) : null}
    </div>
  );
}

/* ── 동영상 블록 편집(업로드) ── */
function VideoBlockEditor({ courseId, activityId, block, onPatch }: { courseId: string; activityId: string; block: Extract<Block, { type: "video" }>; onPatch: (p: Partial<Block>) => void }) {
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setErr("동영상 파일만 업로드할 수 있습니다.");
      return;
    }
    setUploading(true);
    setPct(0);
    try {
      const meta = await uploadVideo(courseId, activityId, f, setPct);
      onPatch({ name: meta.name, size: meta.size, videoKey: meta.videoKey } as Partial<Block>);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {block.videoKey ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-[8px] border px-3 py-2" style={{ borderColor: LINE, background: PANEL }}>
            <Video size={15} style={{ color: BROWN }} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: DEEP }}>{block.name || "동영상"}</span>
            <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>{block.size ? fmtSize(block.size) : ""}</span>
            <label className="shrink-0 cursor-pointer text-[12px] font-semibold" style={{ color: BROWN }}>
              교체<input type="file" accept="video/*" onChange={pick} className="hidden" disabled={uploading} />
            </label>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls preload="metadata" className="w-full rounded-[8px]" style={{ maxHeight: 300, background: "#000" }} src={`/api/courses/${courseId}/lessons/${activityId}/video?blockId=${block.id}`} />
        </div>
      ) : uploading ? (
        <div className="rounded-[8px] border px-3 py-3" style={{ borderColor: LINE }}>
          <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: DEEP }}>업로드 중… {pct}% (닫지 마세요)</p>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#EDE7DA" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BROWN }} />
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-dashed py-4 text-[13px]" style={{ borderColor: LINE, color: SUB }}>
          <Video size={16} /> 동영상 업로드 (최대 5GB · R2로 직접 전송)
          <input type="file" accept="video/*" onChange={pick} className="hidden" />
        </label>
      )}
      {err ? <p className="mt-1.5 text-[12px]" style={{ color: "#a6402c" }}>{err}</p> : null}
    </div>
  );
}

function AddBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-[8px] border bg-white px-3 py-2 text-[13px] font-semibold transition hover:border-[#8C6E59]" style={{ borderColor: LINE, color: DEEP }}>
      {icon} {label}
    </button>
  );
}

/* ── 뷰 ── */
function BlockView({ block, courseId, activityId }: { block: Block; courseId: string; activityId: string }) {
  if (block.type === "heading") return <h3 className="pt-2 text-[19px] font-bold" style={{ ...serif, color: BROWN }}>{block.text || "제목"}</h3>;
  if (block.type === "text") return <p className="whitespace-pre-line text-[15px] leading-8" style={{ color: BODY }}>{block.text}</p>;
  if (block.type === "divider") return <hr style={{ borderColor: CARD }} />;
  if (block.type === "video")
    return block.videoKey ? (
      <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: LINE, background: "#000" }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video controls preload="metadata" className="w-full" style={{ maxHeight: 520 }} src={`/api/courses/${courseId}/lessons/${activityId}/video?blockId=${block.id}`} />
      </div>
    ) : (
      <p className="rounded-[10px] py-3 text-center text-[13px]" style={{ background: PANEL, color: SUB }}>동영상이 아직 업로드되지 않았습니다.</p>
    );
  if (block.type === "file")
    return (
      <button type="button" onClick={() => block.dataUrl && download(block.name, block.dataUrl)} className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition hover:border-[#8C6E59]" style={{ borderColor: LINE, background: PANEL }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: BROWN }}><Paperclip size={16} /></span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold" style={{ color: DEEP }}>{block.name || "파일"}</span>
          <span className="text-[12px]" style={{ color: MUTED }}>{block.size ? fmtSize(block.size) : ""} · 클릭하여 다운로드</span>
        </span>
      </button>
    );
  // link
  return (
    <a href={block.url || "#"} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-[10px] border px-4 py-3 transition hover:border-[#8C6E59]" style={{ borderColor: LINE }}>
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: PANEL, color: BROWN }}><Link2 size={16} /></span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold" style={{ color: INK }}>{block.title || block.url || "링크"}</span>
        {block.url ? <span className="block truncate text-[12.5px]" style={{ color: MUTED }}>{block.url}</span> : null}
        {block.desc ? <span className="mt-0.5 block text-[13px]" style={{ color: SUB }}>{block.desc}</span> : null}
      </span>
    </a>
  );
}

/* ── 편집 ── */
function BlockEditor({ block, courseId, activityId, onPatch, onRemove, onUp, onDown, onFile }: {
  block: Block;
  courseId: string;
  activityId: string;
  onPatch: (p: Partial<Block>) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const typeLabel = { heading: "제목", text: "텍스트", file: "파일", video: "동영상", link: "링크", divider: "구분선" }[block.type];
  const inputCls = "w-full rounded-[8px] border px-3 py-2 text-[14px] outline-none focus:border-[#8C6E59]";
  const inputStyle = { borderColor: "#E7E2D6", color: BODY } as const;
  return (
    <div className="rounded-[12px] border p-3.5" style={{ borderColor: CARD, background: "#fff" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-[6px] px-2 py-0.5 text-[11px] font-bold" style={{ background: PANEL, color: BROWN }}>{typeLabel}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onUp} className="grid h-7 w-7 place-items-center rounded hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="위로"><ArrowUp size={15} /></button>
          <button type="button" onClick={onDown} className="grid h-7 w-7 place-items-center rounded hover:bg-[#F0EBE0]" style={{ color: MUTED }} aria-label="아래로"><ArrowDown size={15} /></button>
          <button type="button" onClick={onRemove} className="grid h-7 w-7 place-items-center rounded hover:bg-[#fbeae7]" style={{ color: "#a6402c" }} aria-label="삭제"><Trash2 size={15} /></button>
        </div>
      </div>

      {block.type === "heading" ? (
        <input value={block.text} onChange={(e) => onPatch({ text: e.target.value })} placeholder="제목을 입력하세요" className={`${inputCls} font-bold`} style={inputStyle} />
      ) : null}
      {block.type === "text" ? (
        <textarea value={block.text} onChange={(e) => onPatch({ text: e.target.value })} rows={4} placeholder="내용을 입력하세요" className={`${inputCls} resize-y leading-7`} style={inputStyle} />
      ) : null}
      {block.type === "divider" ? <hr style={{ borderColor: CARD }} /> : null}
      {block.type === "file" ? (
        <div>
          {block.dataUrl ? (
            <div className="flex items-center justify-between gap-2 rounded-[8px] border px-3 py-2" style={{ borderColor: LINE, background: PANEL }}>
              <button type="button" onClick={() => download(block.name, block.dataUrl)} className="flex min-w-0 items-center gap-2 text-left">
                <Paperclip size={15} style={{ color: BROWN }} />
                <span className="truncate text-[13.5px] font-semibold" style={{ color: DEEP }}>{block.name}</span>
                <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>{fmtSize(block.size)}</span>
                <Download size={14} style={{ color: MUTED }} />
              </button>
              <label className="shrink-0 cursor-pointer text-[12px] font-semibold" style={{ color: BROWN }}>
                교체<input type="file" onChange={onFile} className="hidden" />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-dashed py-3 text-[13px]" style={{ borderColor: LINE, color: SUB }}>
              <Paperclip size={15} /> 파일 선택 (최대 6MB)
              <input type="file" onChange={onFile} className="hidden" />
            </label>
          )}
        </div>
      ) : null}
      {block.type === "video" ? (
        <VideoBlockEditor courseId={courseId} activityId={activityId} block={block} onPatch={onPatch} />
      ) : null}
      {block.type === "link" ? (
        <div className="space-y-2">
          <input value={block.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder="링크 제목" className={inputCls} style={inputStyle} />
          <input value={block.url} onChange={(e) => onPatch({ url: e.target.value })} placeholder="https://…" className={inputCls} style={inputStyle} />
          <input value={block.desc} onChange={(e) => onPatch({ desc: e.target.value })} placeholder="설명(선택)" className={inputCls} style={inputStyle} />
        </div>
      ) : null}
    </div>
  );
}
