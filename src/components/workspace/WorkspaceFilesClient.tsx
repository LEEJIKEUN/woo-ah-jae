"use client";

import { useState } from "react";
import { formatKstDateTime } from "@/lib/date-format";

type FileItem = {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: {
    id: string;
    name: string;
    school: string;
    grade: string;
  };
};

export default function WorkspaceFilesClient({ projectId, initialItems }: { projectId: string; initialItems: FileItem[] }) {
  const [items, setItems] = useState<FileItem[]>(initialItems);
  const [uploading, setUploading] = useState(false);

  async function reload() {
    const res = await fetch(`/api/workspace/${projectId}/files`);
    const json = (await res.json()) as { items?: FileItem[] };
    setItems(json.items ?? []);
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`/api/workspace/${projectId}/upload`, {
        method: "POST",
        body: formData,
      });
      const uploadJson = (await uploadRes.json()) as {
        error?: string;
        fileUrl?: string;
        fileName?: string;
        mimeType?: string;
        size?: number;
      };
      if (!uploadRes.ok || !uploadJson.fileUrl || !uploadJson.fileName || !uploadJson.mimeType || !uploadJson.size) {
        throw new Error(uploadJson.error ?? "파일 업로드 실패");
      }

      const registerRes = await fetch(`/api/workspace/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: uploadJson.fileUrl,
          fileName: uploadJson.fileName,
          mimeType: uploadJson.mimeType,
          size: uploadJson.size,
        }),
      });
      if (!registerRes.ok) throw new Error("자료실 등록 실패");

      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">자료실</h1>
        <label className="cursor-pointer rounded-md border border-slate-500 px-3 py-2 text-xs text-slate-100 hover:border-slate-300">
          파일 업로드
          <input
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {uploading ? <p className="text-xs text-slate-400">업로드 중...</p> : null}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">업로드된 파일이 없습니다.</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">{item.fileName}</p>
                  <p className="text-xs text-slate-400">{item.mimeType} · {(item.size / 1024 / 1024).toFixed(2)}MB</p>
                  <p className="text-xs text-slate-500">업로더: {item.uploader.school} · {item.uploader.grade} · {item.uploader.name}</p>
                  <p className="text-xs text-slate-500">{formatKstDateTime(item.createdAt)}</p>
                </div>
                <a href={item.fileUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-500 px-2 py-1 text-xs text-slate-100 hover:border-slate-300">
                  열기
                </a>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
