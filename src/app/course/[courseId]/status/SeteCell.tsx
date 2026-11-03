"use client";

import { useState } from "react";
import LinkifiedText from "@/components/LinkifiedText";

const BROWN = "#8C6E59";
const PREVIEW_MAX = 90;

/** 세특 첫 문장(제목) — `<…한 학생>` 꼴 머리말이 있으면 그것을, 없으면 첫 줄의 첫 문장을 쓴다. */
export function seteHeadline(text: string): string {
  const t = text.trim();
  if (t.startsWith("<")) {
    const end = t.indexOf(">");
    if (end > 0 && end <= 200) return t.slice(0, end + 1);
  }
  const firstLine = t.split(/\r?\n/)[0] ?? "";
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(firstLine);
  const s = (m ? m[0] : firstLine).trim();
  return s.length > PREVIEW_MAX ? `${s.slice(0, PREVIEW_MAX).trimEnd()}…` : s;
}

/**
 * 세특·과제 현황 표의 세특 칸 — 기본은 첫 문장(머리말)만 보이고 '더보기'로 전체를 펼친다.
 * 표가 세로로 길어져 한눈에 못 보던 문제를 해결(저장값은 변경 없음, 표시만).
 */
export default function SeteCell({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const head = seteHeadline(text);
  const hasMore = text.trim().length > head.length;
  if (!hasMore) return <LinkifiedText text={text} className="leading-6" />;

  const moreLabel = head.endsWith("…") ? "더보기" : "… 더보기";
  return (
    <div>
      {open ? <LinkifiedText text={text} className="leading-6" /> : <span className="leading-6">{head}</span>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 inline-flex items-center whitespace-nowrap text-[12px] font-semibold hover:underline"
        style={{ color: BROWN }}
        aria-expanded={open}
        title={open ? "첫 문장만 보기" : "세특 전체 보기"}
      >
        {open ? "접기" : moreLabel}
      </button>
    </div>
  );
}
