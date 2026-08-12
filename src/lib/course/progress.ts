/** 완료 상태 localStorage 키 (데모: DB 없이 진도 저장). courseId 별로 분리. */
export function doneKey(courseId: string): string {
  return `wj_course_done_${courseId}`;
}

/** 완료 개수 → 진도율(%) 정수 반올림. */
export function percentDone(doneCount: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((doneCount / total) * 100);
}
