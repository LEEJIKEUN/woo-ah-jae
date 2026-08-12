"use client";

import type { Course } from "@/lib/course/content";
import { BC } from "@/lib/course/theme";
import { CompletionProvider } from "./completion";
import BcSidebar from "./BcSidebar";

/**
 * 부스트코스 스타일 코스 셸: 완료 컨텍스트 + 좌측 사이드바(320) + 우측 콘텐츠 슬롯.
 * 코스 홈/활동 상세가 공유. onSelectModule 이 있으면(코스 홈) 사이드바 챕터가 우측을 전환,
 * 없으면(활동 상세) 챕터가 코스 홈으로 링크된다.
 */
export default function BcCourseShell({
  course,
  activeModuleId,
  onSelectModule,
  isStaff = false,
  children,
}: {
  course: Course;
  activeModuleId: string;
  onSelectModule?: (id: string) => void;
  isStaff?: boolean;
  children: React.ReactNode;
}) {
  return (
    <CompletionProvider courseId={course.id}>
      <div className="flex w-full flex-1 bg-white">
        <BcSidebar course={course} activeModuleId={activeModuleId} onSelectModule={onSelectModule} isStaff={isStaff} />
        <div className="min-w-0 flex-1 px-5 py-8 md:px-12 lg:px-16" style={{ color: BC.ink }}>
          <div className="mx-auto max-w-[860px]">{children}</div>
        </div>
      </div>
    </CompletionProvider>
  );
}
