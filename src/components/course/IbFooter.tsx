import { IB } from "@/lib/course/theme";

const LINKS = ["이용약관", "저작권", "개인정보처리방침", "IB 워크숍 안내", "고객센터"];

/** 강의 포털 하단 남색 푸터 — 레퍼런스 onlinepl 푸터 스타일. */
export default function IbFooter() {
  return (
    <footer className="w-full px-4 py-8 text-center text-white" style={{ background: IB.navyDark }}>
      <p className="text-[13px]">© 우아재 (Woo Ah Jae), 2026 · 온라인 워크숍 플랫폼</p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-white/80">
        {LINKS.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            {i > 0 ? <span className="text-white/40">|</span> : null}
            <button type="button" className="hover:text-white hover:underline">
              {label}
            </button>
          </span>
        ))}
      </p>
      <p className="mt-2 text-[11.5px] text-white/60">
        본 화면은 재외국민특별전형 학생 워크숍을 위한 데모 강의 포털입니다.
      </p>
    </footer>
  );
}
