"use client";

import { useState } from "react";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-400";

export default function WorkspaceSettingsForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: {
    pinnedNotice: string | null;
    googleDriveUrl: string | null;
    googleSheetUrl: string | null;
    googleDocsUrl: string | null;
    zoomMeetingUrl: string | null;
    pptUrl: string | null;
    finalReportPdfUrl: string | null;
  };
}) {
  const [pinnedNotice, setPinnedNotice] = useState(initial.pinnedNotice ?? "");
  const [googleDriveUrl, setGoogleDriveUrl] = useState(initial.googleDriveUrl ?? "");
  const [googleSheetUrl, setGoogleSheetUrl] = useState(initial.googleSheetUrl ?? "");
  const [googleDocsUrl, setGoogleDocsUrl] = useState(initial.googleDocsUrl ?? "");
  const [zoomMeetingUrl, setZoomMeetingUrl] = useState(initial.zoomMeetingUrl ?? "");
  const [pptUrl, setPptUrl] = useState(initial.pptUrl ?? "");
  const [finalReportPdfUrl, setFinalReportPdfUrl] = useState(initial.finalReportPdfUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pinnedNotice: pinnedNotice.trim() || null,
          googleDriveUrl: googleDriveUrl.trim() || null,
          googleSheetUrl: googleSheetUrl.trim() || null,
          googleDocsUrl: googleDocsUrl.trim() || null,
          zoomMeetingUrl: zoomMeetingUrl.trim() || null,
          pptUrl: pptUrl.trim() || null,
          finalReportPdfUrl: finalReportPdfUrl.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      setMessage("워크스페이스 설정이 저장되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">상단 고정 공지</span>
        <textarea value={pinnedNotice} onChange={(e) => setPinnedNotice(e.target.value)} rows={5} className={INPUT_CLASS} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">Google Drive URL</span>
        <input
          value={googleDriveUrl}
          onChange={(e) => setGoogleDriveUrl(e.target.value)}
          className={INPUT_CLASS}
          placeholder="https://drive.google.com/drive/folders/..."
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">Google Sheet URL</span>
        <input value={googleSheetUrl} onChange={(e) => setGoogleSheetUrl(e.target.value)} className={INPUT_CLASS} placeholder="https://docs.google.com/spreadsheets/..." />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">Google Docs URL</span>
        <input value={googleDocsUrl} onChange={(e) => setGoogleDocsUrl(e.target.value)} className={INPUT_CLASS} placeholder="https://docs.google.com/document/..." />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">Zoom Meeting URL</span>
        <input value={zoomMeetingUrl} onChange={(e) => setZoomMeetingUrl(e.target.value)} className={INPUT_CLASS} placeholder="https://zoom.us/j/..." />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">PPT URL</span>
        <input value={pptUrl} onChange={(e) => setPptUrl(e.target.value)} className={INPUT_CLASS} placeholder="https://docs.google.com/presentation/..." />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-slate-300">최종 보고서(PDF)</span>
        <input value={finalReportPdfUrl} onChange={(e) => setFinalReportPdfUrl(e.target.value)} className={INPUT_CLASS} placeholder="https://.../final-report.pdf" />
      </label>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button type="button" disabled={loading} onClick={submit} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60">
        {loading ? "저장 중..." : "저장"}
      </button>
    </section>
  );
}
