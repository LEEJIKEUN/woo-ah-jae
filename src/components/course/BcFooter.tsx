import { ChevronUp } from "lucide-react";
import { BC } from "@/lib/course/theme";

/** 강의 포털 하단 푸터 — 부스트코스 스타일(다크바). */
export default function BcFooter() {
  return (
    <footer className="w-full px-6 py-6" style={{ background: BC.footer }}>
      <div className="mx-auto flex max-w-[1140px] items-center justify-between">
        <p className="text-[12px] text-white/55">© 우아재 · 온라인 러닝 데모. All Rights Reserved.</p>
        <a
          href="#top"
          aria-label="맨 위로"
          className="grid h-8 w-8 place-items-center rounded-[4px] border text-white/70 hover:text-white"
          style={{ borderColor: "rgba(255,255,255,0.25)" }}
        >
          <ChevronUp size={16} />
        </a>
      </div>
    </footer>
  );
}
