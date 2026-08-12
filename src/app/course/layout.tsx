import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "강의 포털 · 우아재",
  description: "우아재 온라인 서재 — 강좌 소개와 학습",
};

/** 강의 포털 셸 — 전역 홈 Header/Footer 를 그대로 사용, 흰 바탕만 제공. */
export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-white">{children}</div>;
}
