"use client";

/**
 * 강의실 사이드바 초기값(서버 계산) 컨텍스트.
 * 서버 레이아웃이 실효 강좌명·형식·시청 진도율을 내려주면, 사이드바가 SSR 시점부터 정확히 렌더.
 */
import { createContext, useContext } from "react";

export type CourseMetaInitial = { title?: string; format?: string; watchPct?: number | null };

const Ctx = createContext<CourseMetaInitial>({});

export function CourseMetaProvider({ value, children }: { value: CourseMetaInitial; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCourseMetaInitial(): CourseMetaInitial {
  return useContext(Ctx);
}
