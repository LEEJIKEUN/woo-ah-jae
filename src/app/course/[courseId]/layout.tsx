import { CourseMetaProvider } from "@/components/course/course-meta-context";
import { getSidebarInitial } from "@/lib/course/sidebar-initial";

export const dynamic = "force-dynamic";

/**
 * 강의실(/course/[courseId]/*) 공통 레이아웃 — 사이드바 초기값(실효 강좌명·형식·시청 진도율)을
 * 서버에서 계산해 컨텍스트로 제공. SSR HTML이 처음부터 정확해 새로고침 깜빡임이 없다.
 * 실패해도 빈 값으로 폴백(사이드바는 기존 클라이언트 동작 유지).
 */
export default async function CourseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const initial = await getSidebarInitial(courseId).catch(() => ({}));
  return <CourseMetaProvider value={initial}>{children}</CourseMetaProvider>;
}
