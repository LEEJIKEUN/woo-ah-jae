"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";

const BROWN = "#8C6E59";
const DEEP = "#6B5342";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Notice = { id: string; pinned: boolean; title: string; author: string; date: string; body: string };

const NOTICES: Notice[] = [
  {
    id: "n1",
    pinned: true,
    title: "📢 인공지능을 위한 선형대수학 · 8주(16회) 과정 안내",
    author: "우아재 관리자",
    date: "2026.08.11",
    body: "매주 월·수 19:00~20:30 온라인 실시간 수업으로 진행됩니다. 각 주차는 시작일 00:00에 자동으로 열리며, 강의노트를 먼저 본 뒤 실습과 수행평가를 진행하세요. 9.24.~10.25.는 탐구 프로젝트 기간입니다.",
  },
  {
    id: "n2",
    pinned: true,
    title: "🔥 1주차 준비물 안내 — 구글 계정 · Colab 접속 확인",
    author: "우아재 관리자",
    date: "2026.08.14",
    body: "첫 수업 전 구글 계정과 Colab 접속을 미리 확인해 주세요. 자체 제작 교재와 학생별 실습 노트북이 배포됩니다.",
  },
  {
    id: "n3",
    pinned: false,
    title: "수행평가 1 일정 안내 (1~5장 · 실습 1·2)",
    author: "우아재 관리자",
    date: "2026.09.07",
    body: "4주차(9.7)에 수행평가 1이 부과됩니다. 마감은 9.13.(월) 12:00까지이며, 강의실의 해당 주차에서 제출 안내를 확인하세요.",
  },
];

export default function NoticesView({ courseId, isStaff = false }: { courseId: string; isStaff?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff={isStaff} />

      <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-[860px]">
          <Link href={`/course/${courseId}/learn`} className="mb-2 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>
            <ChevronLeft size={14} /> 강의실
          </Link>
          <h1 className="text-[30px] font-normal" style={{ ...serif, color: INK, letterSpacing: "-0.02em" }}>공지사항</h1>

          <div className="mt-6 border-t" style={{ borderColor: LINE }} />

          <ul>
            {NOTICES.map((n) => {
              const isOpen = open === n.id;
              return (
                <li key={n.id} className="border-b" style={{ borderColor: "#F0EBE0" }}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : n.id)} className="flex w-full items-center gap-4 py-6 text-left transition hover:opacity-80">
                    <div className="min-w-0 flex-1">
                      {n.pinned ? (
                        <span className="mb-2 inline-block rounded-[6px] px-2.5 py-1 text-[12px] font-bold" style={{ background: "#EFE7DA", color: DEEP }}>주목할 글</span>
                      ) : null}
                      <p className="text-[18px] font-semibold" style={{ color: INK }}>{n.title}</p>
                      <div className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: SUB }}>
                        <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ ...serif, background: BROWN }}>齋</span>
                        <span style={{ color: BODY }}>{n.author}</span>
                        <span style={{ color: BROWN }}>관리자</span>
                        <span style={{ color: "#ddd" }}>|</span>
                        <span style={{ color: MUTED }}>{n.date}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={20} style={{ color: MUTED }} /> : <ChevronDown size={20} style={{ color: MUTED }} />}
                  </button>
                  {isOpen ? (
                    <div className="mb-6 rounded-[12px] px-5 py-4 text-[15px] leading-8" style={{ background: PANEL, color: BODY }}>
                      {n.body}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
