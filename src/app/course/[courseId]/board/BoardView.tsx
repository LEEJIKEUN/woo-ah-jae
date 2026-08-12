"use client";

import CourseBoard from "@/components/course/CourseBoard";

export default function BoardView(props: {
  courseId: string;
  isStaff?: boolean;
  isParent?: boolean;
  role: string;
  currentUserId: string;
}) {
  return <CourseBoard kind="DISCUSSION" {...props} />;
}
