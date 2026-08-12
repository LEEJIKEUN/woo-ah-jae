import Link from "next/link";
import { Search } from "lucide-react";
import { BC } from "@/lib/course/theme";

const serif = { fontFamily: "var(--font-serif)" } as const;

/** 강의 포털 상단 GNB — 서재 무드(먹빛 현판 + 명조 + 齋 낙관). */
export default function BcGnb() {
  return (
    <header className="sticky top-0 z-30 flex h-[56px] w-full">
      {/* 좌측 로고 영역 */}
      <div className="hidden w-[320px] shrink-0 items-center gap-2.5 px-6 lg:flex" style={{ background: BC.gnbDark }}>
        <span className="grid h-8 w-8 place-items-center rounded-[5px] text-white" style={{ background: "#a6402c", ...serif, fontSize: 15, transform: "rotate(-3deg)" }}>齋</span>
        <Link href="/" className="text-[19px] font-semibold tracking-tight text-white" style={serif}>
          우아재
        </Link>
      </div>

      {/* 우측 영역 */}
      <div className="flex flex-1 items-center gap-3 px-4 md:px-6" style={{ background: BC.gnb }}>
        <Link href="/" className="text-[17px] font-semibold tracking-tight text-white lg:hidden" style={serif}>우아재</Link>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-[4px] px-3 py-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
            <input placeholder="검색" disabled className="w-32 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/40 md:w-48" />
            <Search size={15} className="text-white/60" />
          </div>
          <Link href="/" className="rounded-[4px] border px-4 py-1.5 text-[13px] text-white/90 transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)", ...serif }}>
            서재 나가기
          </Link>
        </div>
      </div>
    </header>
  );
}
