import { ChevronUp } from "lucide-react";
import Logo from "@/components/nav/Logo";

const BROWN = "#8c6e59";
const SUB = "#8a8479";
const LINE = "#ece7df";
const serif = { fontFamily: "var(--font-serif)" } as const;

/** 글로벌 푸터 — 흰 바탕 · 글자 위주 (ondl 톤). (/course 는 자체 푸터가 덮음) */
export default function Footer() {
  return (
    <footer className="w-full bg-white">
      <div className="w-full px-5 py-14 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between">
          <div>
            <Logo size={30} />
            <p className="mt-4 text-[13px] leading-6" style={{ color: SUB }}>
              온라인에 세운 새로운 서재 · 才를 발견하고, 齋에서 자란다.
              <br />
              문의 help@wooahjae.example
            </p>
          </div>
          <a href="#top" aria-label="맨 위로" className="grid h-9 w-9 place-items-center border" style={{ borderColor: LINE, color: SUB }}>
            <ChevronUp size={16} />
          </a>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]" style={{ color: SUB }}>
          <span style={{ color: BROWN }}>서재</span>
          <span style={{ color: LINE }}>|</span>
          <span>이용약관</span>
          <span style={{ color: LINE }}>|</span>
          <span>개인정보처리방침</span>
        </div>
        <p className="mt-4 text-[12px]" style={{ ...serif, color: "#b8b1a4" }}>© 2026 우아재. 천천히, 깊게, 제대로.</p>
      </div>
    </footer>
  );
}
