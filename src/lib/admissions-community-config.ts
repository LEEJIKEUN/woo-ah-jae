export const ADMISSIONS_COMMUNITY_KEY = "admissions";

export const ADMISSIONS_NOTICE_BOARD = {
  slug: "notice",
  name: "공지사항",
  isNotice: true,
  sortOrder: 0,
} as const;

export const ADMISSIONS_GROUPS = [
  {
    sortOrder: 1,
    name: "특례/전형 기본",
    boards: [
      { slug: "special-eligibility-prep", name: "특례 자격조건 및 준비", sortOrder: 1 },
      { slug: "overseas-korean-special", name: "재외국민 특례", sortOrder: 2 },
      { slug: "foreign-university-track", name: "외국대 전형", sortOrder: 3 },
      { slug: "early-special-talent", name: "수시 및 특기자", sortOrder: 4 },
    ],
  },
  {
    sortOrder: 2,
    name: "교육 및 입시 소식",
    boards: [{ slug: "education-admission-news", name: "교육 및 입시 관련 소식", sortOrder: 1 }],
  },
  {
    sortOrder: 3,
    name: "특례 과목",
    boards: [
      { slug: "special-math", name: "특례 수학", sortOrder: 1 },
      { slug: "special-korean", name: "특례 국어", sortOrder: 2 },
      { slug: "special-english", name: "특례 영어", sortOrder: 3 },
    ],
  },
  {
    sortOrder: 4,
    name: "공인시험/트랙",
    boards: [
      { slug: "korean-curriculum", name: "한국교육과정", sortOrder: 1 },
      { slug: "sat-act", name: "SAT, ACT", sortOrder: 2 },
      { slug: "ibt-toeic-teps", name: "iBT. TOEIC. TEPS", sortOrder: 3 },
      { slug: "ib", name: "IB", sortOrder: 4 },
      { slug: "ap", name: "AP", sortOrder: 5 },
      { slug: "a-level", name: "A-level", sortOrder: 6 },
    ],
  },
] as const;
