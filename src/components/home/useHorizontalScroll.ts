"use client";

import { RefObject, useMemo } from "react";

export function useHorizontalScroll(ref: RefObject<HTMLElement | null>) {
  return useMemo(
    () => ({
      scrollPrev: () => {
        const el = ref.current;
        if (!el) return;
        el.scrollBy({ left: -Math.max(320, Math.floor(el.clientWidth * 0.85)), behavior: "smooth" });
      },
      scrollNext: () => {
        const el = ref.current;
        if (!el) return;
        el.scrollBy({ left: Math.max(320, Math.floor(el.clientWidth * 0.85)), behavior: "smooth" });
      },
    }),
    [ref]
  );
}
