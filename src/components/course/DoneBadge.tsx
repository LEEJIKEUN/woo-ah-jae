"use client";

import { Check } from "lucide-react";
import type { CompletionMode } from "@/lib/course/content";
import { IB } from "@/lib/course/theme";
import { useCompletion } from "./completion";

/** 활동 완료 배지/버튼 — 레퍼런스의 초록 "Done" 배지 + "Mark as done" 아웃라인 버튼. */
export default function DoneBadge({
  activityId,
  mode,
  size = "md",
}: {
  activityId: string;
  mode: CompletionMode;
  size?: "sm" | "md";
}) {
  const { isDone, toggle } = useCompletion();
  const done = isDone(activityId);
  const pad = size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]";

  if (mode === "none") return null;

  if (done) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md font-semibold ${pad}`}
        style={{ background: IB.doneBg, color: IB.doneText }}
      >
        <Check size={14} strokeWidth={3} /> 완료
      </span>
    );
  }

  if (mode === "manual") {
    return (
      <button
        type="button"
        onClick={() => toggle(activityId, true)}
        className={`inline-flex items-center gap-1.5 rounded-md border bg-white font-medium transition hover:bg-slate-50 ${pad}`}
        style={{ borderColor: IB.border, color: IB.body }}
      >
        완료로 표시
      </button>
    );
  }

  // auto: 열람 시 자동 완료
  return (
    <span className={`inline-flex items-center gap-1 rounded-md ${pad}`} style={{ color: IB.muted }}>
      열람 시 자동 완료
    </span>
  );
}
