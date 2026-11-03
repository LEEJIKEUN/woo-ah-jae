/**
 * 활동 정리 PDF '포함 항목' 체크박스 목록 — 클라이언트 공용(멘토링 페이지·세특 현황 일괄 처리).
 * 키는 서버 `DOSSIER_SECTION_KEYS`(lib/mentoring/dossier.ts)와 동일해야 한다. 과제는 슬롯(ASSIGN_SLOTS)별로 따로 고른다.
 */
export const DOSSIER_SECTIONS: { key: string; label: string }[] = [
  { key: "report", label: "탐구 보고서" },
  { key: "report_file", label: "보고서 원본 첨부" },
  { key: "books", label: "독서활동" },
  { key: "chat", label: "멘토링 대화" },
  { key: "notice", label: "개별 공지" },
  { key: "board", label: "토론 게시판" },
  { key: "community", label: "커뮤니티 게시판" },
  { key: "standards", label: "성취기준" },
];
export const ASSIGN_SLOTS = [0, 1, 2, 3, 4]; // 과제1~5 슬롯

export function toggleSet<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}
