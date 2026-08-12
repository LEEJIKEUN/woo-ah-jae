import Link from "next/link";
import { Bell, MessageSquare, Search, ChevronDown } from "lucide-react";
import { IB } from "@/lib/course/theme";

/** 강의 포털 상단 흰색 헤더 — 레퍼런스(onlinepl) 헤더 레이아웃을 우아재 브랜드로. */
export default function IbHeader({ courseCount = 1 }: { courseCount?: number }) {
  return (
    <header
      className="sticky top-0 z-30 flex h-[64px] w-full items-center gap-6 border-b bg-white px-4 md:px-8"
      style={{ borderColor: IB.border }}
    >
      {/* 브랜드 */}
      <Link href="/course" className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-md text-[15px] font-extrabold text-white"
          style={{ background: IB.navy }}
        >
          재
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-bold" style={{ color: IB.ink }}>
            우아재
          </span>
          <span className="block text-[10.5px] font-medium" style={{ color: IB.muted }}>
            IB 워크숍 · 온라인 러닝
          </span>
        </span>
      </Link>

      {/* 메뉴 */}
      <nav className="ml-2 hidden items-center gap-6 text-[15px] lg:flex" style={{ color: IB.ink }}>
        <Link href="/course" className="flex items-center gap-1.5 font-semibold">
          내 강의
          <span
            className="grid h-5 min-w-5 place-items-center rounded px-1 text-[11px] font-bold text-white"
            style={{ background: IB.navy }}
          >
            {courseCount}
          </span>
        </Link>
        <button type="button" className="flex items-center gap-1 opacity-90 hover:opacity-100">
          자주 묻는 질문 <ChevronDown size={15} />
        </button>
        <button type="button" className="flex items-center gap-1 opacity-90 hover:opacity-100">
          이용 안내 <ChevronDown size={15} />
        </button>
        <button type="button" className="flex items-center gap-1 opacity-90 hover:opacity-100">
          학습 도구 <ChevronDown size={15} />
        </button>
        <button type="button" className="flex items-center gap-1 opacity-90 hover:opacity-100">
          KO <ChevronDown size={15} />
        </button>
      </nav>

      {/* 우측 아이콘 */}
      <div className="ml-auto flex items-center gap-4" style={{ color: IB.ink }}>
        <IconWithBadge count={2}>
          <Bell size={19} />
        </IconWithBadge>
        <IconWithBadge count={1}>
          <MessageSquare size={19} />
        </IconWithBadge>
        <button type="button" aria-label="검색" className="opacity-90 hover:opacity-100">
          <Search size={19} />
        </button>
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-semibold"
          style={{ background: "#E4E6EB", color: IB.ink }}
        >
          나
        </span>
      </div>
    </header>
  );
}

function IconWithBadge({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <button type="button" className="relative opacity-90 hover:opacity-100">
      {children}
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#DC3545] px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
