"use client";

import { useState } from "react";

type Props = {
  sidebar: React.ReactNode;
  main: React.ReactNode;
};

export default function BoardLayout({ sidebar, main }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full py-6">
      <div className="mb-3 flex items-center justify-between px-4 min-[900px]:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm font-semibold text-slate-100"
        >
          게시판 메뉴
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/60 min-[900px]:hidden" onClick={() => setOpen(false)}>
          <div
            className="h-full w-[86%] max-w-[320px] border-r border-slate-700/80 bg-[color:var(--surface)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">게시판</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-600/80 px-2 py-1 text-xs text-slate-200"
              >
                닫기
              </button>
            </div>
            <div className="h-[calc(100vh-84px)] overflow-y-auto">{sidebar}</div>
          </div>
        </div>
      ) : null}

      <div className="min-h-[calc(100vh-var(--header-h)-1.5rem)]">
        <aside className="hidden min-[900px]:fixed min-[900px]:left-0 min-[900px]:top-[var(--header-h)] min-[900px]:z-30 min-[900px]:block min-[900px]:h-[calc(100vh-var(--header-h))] min-[900px]:w-[280px] min-[900px]:overflow-y-auto min-[900px]:px-3">
          {sidebar}
        </aside>
        <main className="min-w-0 min-[900px]:ml-[286px]">
          <div className="mx-auto w-full max-w-[1320px] px-4 md:px-6">{main}</div>
        </main>
      </div>
    </div>
  );
}
