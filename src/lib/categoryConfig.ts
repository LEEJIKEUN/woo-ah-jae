export const PRIMARY_TABS = ["교과", "창체", "교내대회", "교외대회", "공인시험"] as const;

export type CategoryTab = (typeof PRIMARY_TABS)[number];

export const CHANNELS_BY_TAB: Record<CategoryTab, string[]> = {
  교과: ["국어", "수학", "영어", "과학", "사회", "제2외국어", "미술", "음악", "체육"],
  창체: ["자율활동", "진로활동", "동아리 활동", "공동체 기여 활동", "독서토론"],
  교내대회: ["MUN", "통계관련 대회", "수학 관련 대회", "정보 관련 대회", "소논문 관련 대회", "스피치 관련 대회"],
  교외대회: ["통계포스터대회(통계청)", "엔지니어링산업경진대회(산업통상자원부)"],
  공인시험: ["AP", "IB", "SAT", "TOEFL", "TOPIK"],
};

export const FILTER_OPTIONS = {
  date: [
    { value: "all", label: "날짜 전체" },
    { value: "7d", label: "최근 7일" },
    { value: "30d", label: "최근 30일" },
  ],
  grade: [
    { value: "all", label: "학년 전체" },
    { value: "G9-G11", label: "G9-G11" },
    { value: "G10-G12", label: "G10-G12" },
    { value: "G11-G13", label: "G11-G13" },
  ],
  recruit: [
    { value: "all", label: "모집 상태 전체" },
    { value: "open", label: "모집중" },
    { value: "closed", label: "마감" },
  ],
  kind: [
    { value: "all", label: "유형 전체" },
    { value: "온라인", label: "온라인" },
    { value: "오프라인", label: "오프라인" },
    { value: "하이브리드", label: "하이브리드" },
  ],
} as const;

export type SortOption = "popular" | "latest";

export const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "popular", label: "인기순" },
  { value: "latest", label: "최신순" },
];
