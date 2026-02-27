"use client";

import Link from "next/link";
import { useState } from "react";
import { formatKstDateTime } from "@/lib/date-format";

type TabItem = {
  slug: string;
  name: string;
  description: string;
  posts: Array<{
    id: string;
    title: string;
    categoryTag: string | null;
    createdAt: string;
    authorName: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
  }>;
};

export default function ExamCommunityTabsClient({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.slug ?? "");
  const current = tabs.find((x) => x.slug === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="공인시험 커뮤니티 탭">
        {tabs.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            onClick={() => setActive(tab.slug)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              tab.slug === current.slug ? "bg-slate-100 text-slate-900" : "border border-slate-600 text-slate-200"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-400">{current.description}</p>

      <div className="overflow-hidden rounded-lg border border-slate-700/70">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">말머리</th>
              <th className="px-3 py-2 text-left">제목</th>
              <th className="px-3 py-2 text-left">작성자</th>
              <th className="px-3 py-2 text-left">작성일</th>
              <th className="px-3 py-2 text-right">조회</th>
              <th className="px-3 py-2 text-right">추천</th>
              <th className="px-3 py-2 text-right">댓글</th>
            </tr>
          </thead>
          <tbody>
            {current.posts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  아직 게시글이 없습니다.
                </td>
              </tr>
            ) : (
              current.posts.map((post) => (
                <tr key={post.id} className="border-t border-slate-800/80">
                  <td className="px-3 py-2 text-xs text-slate-400">{post.categoryTag ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/boards/posts/${post.id}`} className="line-clamp-1 text-slate-100 hover:text-white">
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{post.authorName}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatKstDateTime(post.createdAt)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">{post.viewCount}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">{post.likeCount}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">{post.commentCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end">
        <Link href={`/boards/${current.slug}`} className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-300">
          {current.name} 이동
        </Link>
      </div>
    </div>
  );
}
