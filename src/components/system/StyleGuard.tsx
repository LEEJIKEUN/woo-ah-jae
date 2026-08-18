"use client";

import { useEffect } from "react";

/**
 * 스타일시트 로드 실패(=스타일이 전혀 안 먹은 화면) 자가복구.
 *
 * 배포 도중 CSS 청크 요청이 실패하거나, Safari 가 bfcache 로 옛 스냅샷을 복원해
 * `/_next/static/css/*.css` 가 404 나면 페이지가 무스타일(브라우저 기본 serif·좌측정렬)로 뜬다.
 * 이때 '한 번만' 새로고침해 최신 에셋을 받아 스스로 복구한다.
 *
 * 오작동 방지:
 *  - Tailwind 유틸(.hidden→display:none) 미적용 AND 테마 배경 미적용, 두 신호가 모두 있을 때만 무스타일로 판정
 *  - sessionStorage 가드로 최대 1회만 새로고침(무한 루프 차단)
 */
export default function StyleGuard() {
  useEffect(() => {
    const KEY = "wj-style-heal";

    const stylesMissing = (): boolean => {
      // 1) Tailwind 유틸리티가 적용됐는지: .hidden 이면 display:none 이어야 함
      const probe = document.createElement("div");
      probe.className = "hidden";
      document.body.appendChild(probe);
      const display = getComputedStyle(probe).display;
      probe.remove();
      const tailwindMissing = display !== "none";

      // 2) 테마 배경(globals.css body 배경)이 적용됐는지
      const bg = getComputedStyle(document.body).backgroundColor;
      const themeMissing = bg === "rgba(0, 0, 0, 0)" || bg === "transparent" || bg === "rgb(255, 255, 255)";

      return tailwindMissing && themeMissing; // 둘 다일 때만 '무스타일' 확정
    };

    const heal = () => {
      if (!stylesMissing()) {
        sessionStorage.removeItem(KEY); // 정상 → 가드 해제
        return;
      }
      if (sessionStorage.getItem(KEY)) return; // 이미 1회 시도함 → 재시도 안 함(루프 방지)
      sessionStorage.setItem(KEY, "1");
      location.reload();
    };

    const t = setTimeout(heal, 60); // 렌더 안정화 여유
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) heal(); }; // Safari bfcache 복원 시 재확인
    window.addEventListener("pageshow", onShow);
    return () => { clearTimeout(t); window.removeEventListener("pageshow", onShow); };
  }, []);

  return null;
}
