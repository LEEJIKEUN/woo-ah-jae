/**
 * 활동 정리 PDF '포함 항목' 체크박스 목록 — 클라이언트 공용(멘토링 페이지·세특 현황 일괄 처리).
 * 키는 서버 `DOSSIER_SECTION_KEYS`(lib/mentoring/dossier.ts)와 동일해야 한다. 과제는 슬롯(ASSIGN_SLOTS)별로 따로 고른다.
 * (개별 공지·커뮤니티 게시판은 2026-11-04 사용자 요청으로 정리 자료에서 제외)
 */
export const DOSSIER_SECTIONS: { key: string; label: string }[] = [
  { key: "report", label: "탐구 보고서" },
  { key: "report_file", label: "보고서 원본 첨부" },
  { key: "books", label: "독서활동" },
  { key: "chat", label: "멘토링 대화" },
  { key: "board", label: "토론 게시판" },
  { key: "exam", label: "시험 결과" },
  { key: "standards", label: "성취기준" },
];
export const ASSIGN_SLOTS = [0, 1, 2, 3, 4]; // 과제1~5 슬롯

export function toggleSet<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}
