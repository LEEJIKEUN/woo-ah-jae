"use client";

import Link from "next/link";
import { useMemo } from "react";

type SidebarBoard = {
  id: string;
  slug: string;
  name: string;
};

type SidebarGroup = {
  id: string;
  name: string;
  boards: SidebarBoard[];
};

type Props = {
  activeBoard: string;
  noticeBoard: SidebarBoard | null;
  groups: SidebarGroup[];
  query: string;
  sort: "latest" | "views" | "likes" | "comments";
};

export default function AdmissionsSidebar({ activeBoard, noticeBoard, groups, query, sort }: Props) {
  function hrefFor(board: string) {
    const params = new URLSearchParams();
    params.set("board", board);
    if (query) params.set("q", query);
    if (sort !== "latest") params.set("sort", sort);
    return `/community/admissions?${params.toString()}`;
  }

  const boardMap = useMemo(() => {
    const map = new Map<string, SidebarBoard>();
    for (const group of groups) {
      for (const board of group.boards) map.set(board.slug, board);
    }
    return map;
  }, [groups]);

  const sections = useMemo(
    () =>
      [
        {
          header: "입시/전형 기본",
          slugs: ["special-eligibility-prep", "education-admission-news", "overseas-korean-special"],
        },
        {
          header: "특례 과목",
          slugs: ["special-math", "special-korean", "special-english"],
        },
        {
          header: "대학 전형",
          slugs: ["foreign-university-track", "early-special-talent"],
        },
        {
          header: "공인시험/트랙",
          slugs: ["korean-curriculum", "sat-act", "ibt-toeic-teps", "ib", "ap", "a-level"],
        },
      ]
        .map((section) => ({
          ...section,
          boards: section.slugs
            .map((slug) => boardMap.get(slug))
            .filter((item): item is SidebarBoard => Boolean(item)),
        }))
        .filter((section) => section.boards.length > 0),
    [boardMap]
  );

  function labelFor(board: SidebarBoard) {
    if (board.slug === "ibt-toeic-teps") return "iBT, TOEIC, TEPS";
    return board.name;
  }

  function itemClass(selected: boolean) {
    return selected
      ? "relative block rounded-md bg-slate-100/10 px-3 py-1.5 text-sm font-semibold text-slate-100 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sky-300"
      : "relative block rounded-md px-3 py-1.5 text-sm text-slate-300 hover:text-white";
  }

  return (
    <div className="h-full border border-slate-800/80 bg-[color:var(--surface)]/95 p-4">
      <div className="space-y-3">
        <nav className="space-y-2">
          <Link href={hrefFor("all")} className={itemClass(activeBoard === "all")}>
            전체글보기
          </Link>

          {noticeBoard ? (
            <Link href={hrefFor(noticeBoard.slug)} className={itemClass(activeBoard === noticeBoard.slug)}>
              {noticeBoard.name}
            </Link>
          ) : null}

          {sections.map((section) => (
            <section key={section.header} className="space-y-1.5 pt-2">
              <p className="px-3 text-xs font-semibold tracking-wide text-slate-500">{section.header}</p>
              {section.boards.map((board) => (
                <Link key={board.id} href={hrefFor(board.slug)} className={itemClass(activeBoard === board.slug)}>
                  {labelFor(board)}
                </Link>
              ))}
            </section>
          ))}
        </nav>
      </div>
    </div>
  );
}
