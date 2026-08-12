"use client";

import { useMemo, useState } from "react";
import type { Course } from "@/lib/course/content";
import BcCourseShell from "@/components/course/BcCourseShell";
import ChapterLectures from "@/components/course/ChapterLectures";

/** 강좌별 홈 — 부스트코스 스타일(좌 사이드바 아코디언 + 우 강의 카드 리스트). */
export default function CourseHomeClient({
  course,
  initialModuleId,
}: {
  course: Course;
  initialModuleId?: string;
}) {
  const firstId = course.modules[0]?.id ?? "";
  const [activeId, setActiveId] = useState(
    initialModuleId && course.modules.some((m) => m.id === initialModuleId) ? initialModuleId : firstId
  );
  const activeModule = useMemo(
    () => course.modules.find((m) => m.id === activeId) ?? course.modules[0],
    [course.modules, activeId]
  );

  return (
    <BcCourseShell course={course} activeModuleId={activeModule.id} onSelectModule={setActiveId}>
      <ChapterLectures course={course} module={activeModule} />
    </BcCourseShell>
  );
}
