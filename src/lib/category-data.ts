export const TOP_TABS = ["교과", "창체", "교내대회", "교외대회", "공인시험"] as const;

export type TopTab = (typeof TOP_TABS)[number];

export const CHANNELS_BY_TAB: Record<TopTab, string[]> = {
  교과: ["국어", "수학", "영어", "과학", "사회", "제2외국어", "미술", "음악", "체육"],
  창체: ["자율활동", "진로활동", "동아리 활동", "공동체 기여 활동"],
  교내대회: ["MUN", "통계관련 대회", "수학 관련 대회", "정보 관련 대회", "소논문 관련 대회", "스피치 관련 대회"],
  교외대회: ["통계포스터대회(통계청)", "엔지니어링산업경진대회(산업통상자원부)"],
  공인시험: ["AP", "IB", "SAT", "TOEFL", "TOPIK"],
};

export type SortOption = "popular" | "latest" | "basic";

export type PromoItem = {
  id: string;
  tab: TopTab;
  channel: string;
  title: string;
  summary: string;
  thumbnailUrl?: string;
  popularityScore: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  deadline?: string;
  createdAt: string;
  region: string;
  gradeBand: string;
  recruitStatus: "모집중" | "마감임박" | "모집완료";
  kind: "온라인" | "오프라인" | "하이브리드";
};

export const MOCK_PROMOS: PromoItem[] = [
  { id: "p01", tab: "교과", channel: "수학", title: "수학 탐구 보고서 스터디 4주 트랙", summary: "확률과 통계 주제로 탐구 보고서 구조를 함께 완성하는 소규모 팀입니다.", popularityScore: 987, likeCount: 142, commentCount: 31, tags: ["추천", "모집중", "온라인"], deadline: "2026-03-12", createdAt: "2026-02-20", region: "싱가포르", gradeBand: "G10-G12", recruitStatus: "모집중", kind: "온라인" },
  { id: "p02", tab: "교과", channel: "영어", title: "Academic Writing 피드백 클럽", summary: "에세이 초안 교환과 루브릭 기반 피드백으로 글 완성도를 높입니다.", popularityScore: 742, likeCount: 98, commentCount: 27, tags: ["인기", "모집중"], deadline: "2026-03-08", createdAt: "2026-02-18", region: "도쿄", gradeBand: "G9-G11", recruitStatus: "모집중", kind: "온라인" },
  { id: "p03", tab: "교과", channel: "과학", title: "생명과학 실험 설계 미니랩", summary: "가설 수립부터 변수 통제, 데이터 시각화까지 한 사이클을 훈련합니다.", popularityScore: 801, likeCount: 120, commentCount: 18, tags: ["추천", "마감임박"], deadline: "2026-03-02", createdAt: "2026-02-22", region: "하노이", gradeBand: "G10-G13", recruitStatus: "마감임박", kind: "하이브리드" },
  { id: "p04", tab: "교과", channel: "국어", title: "비문학 독해 고난도 지문 세미나", summary: "시간 관리 전략과 오답 유형 분석 중심의 주 2회 스터디입니다.", popularityScore: 634, likeCount: 77, commentCount: 13, tags: ["모집중"], deadline: "2026-03-19", createdAt: "2026-02-16", region: "자카르타", gradeBand: "G9-G12", recruitStatus: "모집중", kind: "온라인" },
  { id: "p05", tab: "교과", channel: "사회", title: "국제정치 이슈 브리핑 팀", summary: "주간 이슈를 정리해 5분 발표와 토론으로 사고력을 확장합니다.", popularityScore: 566, likeCount: 61, commentCount: 12, tags: ["모집중", "발표"], deadline: "2026-03-15", createdAt: "2026-02-14", region: "방콕", gradeBand: "G10-G12", recruitStatus: "모집중", kind: "온라인" },
  { id: "p06", tab: "교과", channel: "체육", title: "스포츠 데이터 분석 프로젝트", summary: "경기 데이터를 수집해 지표를 만들고 시각화 리포트를 완성합니다.", popularityScore: 489, likeCount: 55, commentCount: 9, tags: ["모집중", "데이터"], deadline: "2026-03-25", createdAt: "2026-02-13", region: "홍콩", gradeBand: "G9-G13", recruitStatus: "모집중", kind: "오프라인" },

  { id: "p07", tab: "창체", channel: "진로활동", title: "해외대학 전공 탐색 인터뷰 시리즈", summary: "전공별 선배 인터뷰 질문지를 만들고 인터뷰 리포트를 공동 작성합니다.", popularityScore: 902, likeCount: 135, commentCount: 28, tags: ["추천", "인기"], deadline: "2026-03-11", createdAt: "2026-02-23", region: "미국", gradeBand: "G10-G13", recruitStatus: "모집중", kind: "온라인" },
  { id: "p08", tab: "창체", channel: "동아리 활동", title: "AI 동아리 공동 커리큘럼 제작", summary: "신입 부원을 위한 6주 커리큘럼과 실습 과제를 함께 설계합니다.", popularityScore: 715, likeCount: 88, commentCount: 24, tags: ["인기", "모집중"], deadline: "2026-03-09", createdAt: "2026-02-19", region: "서울", gradeBand: "G9-G12", recruitStatus: "모집중", kind: "하이브리드" },
  { id: "p09", tab: "창체", channel: "자율활동", title: "학교 행사 운영 PM 스쿼드", summary: "행사 기획안을 실무 형태로 작성하고 일정/역할 분배를 시뮬레이션합니다.", popularityScore: 478, likeCount: 52, commentCount: 11, tags: ["모집중"], deadline: "2026-03-18", createdAt: "2026-02-17", region: "두바이", gradeBand: "G10-G12", recruitStatus: "모집중", kind: "오프라인" },
  { id: "p10", tab: "창체", channel: "공동체 기여 활동", title: "지역사회 봉사 프로그램 리디자인", summary: "문제정의-솔루션-성과지표까지 문서화해 학교 제안서로 제출합니다.", popularityScore: 521, likeCount: 63, commentCount: 16, tags: ["발표", "모집중"], deadline: "2026-03-22", createdAt: "2026-02-15", region: "밴쿠버", gradeBand: "G9-G13", recruitStatus: "모집중", kind: "하이브리드" },

  { id: "p11", tab: "교내대회", channel: "MUN", title: "MUN 의제 리서치 집중반", summary: "국가 포지션 페이퍼 작성과 스피치 리허설을 병행하는 실전형 팀입니다.", popularityScore: 1098, likeCount: 178, commentCount: 45, tags: ["추천", "인기", "마감임박"], deadline: "2026-03-01", createdAt: "2026-02-24", region: "홍콩", gradeBand: "G10-G13", recruitStatus: "마감임박", kind: "하이브리드" },
  { id: "p12", tab: "교내대회", channel: "통계관련 대회", title: "통계 포스터 교내 예선 준비팀", summary: "가설 설정부터 시각화 스토리텔링까지 포스터 한 장으로 완성합니다.", popularityScore: 677, likeCount: 80, commentCount: 20, tags: ["모집중", "데이터"], deadline: "2026-03-13", createdAt: "2026-02-21", region: "상하이", gradeBand: "G10-G12", recruitStatus: "모집중", kind: "온라인" },
  { id: "p13", tab: "교내대회", channel: "정보 관련 대회", title: "알고리즘 해커톤 교내전 대비", summary: "기출 유형별 문제풀이와 팀 역할 분담으로 대회 운영을 연습합니다.", popularityScore: 844, likeCount: 112, commentCount: 29, tags: ["인기", "모집중"], deadline: "2026-03-06", createdAt: "2026-02-22", region: "싱가포르", gradeBand: "G9-G12", recruitStatus: "모집중", kind: "온라인" },
  { id: "p14", tab: "교내대회", channel: "소논문 관련 대회", title: "소논문 초록 피드백 라운드", summary: "연구질문 정교화와 방법론 정합성 점검을 중심으로 피드백합니다.", popularityScore: 598, likeCount: 71, commentCount: 14, tags: ["모집중", "연구"], deadline: "2026-03-20", createdAt: "2026-02-15", region: "뉴욕", gradeBand: "G11-G13", recruitStatus: "모집중", kind: "온라인" },
  { id: "p15", tab: "교내대회", channel: "스피치 관련 대회", title: "영어 스피치 교내대회 코칭", summary: "오프닝/본론/클로징 구조를 다듬고 무대 동선까지 리허설합니다.", popularityScore: 553, likeCount: 60, commentCount: 15, tags: ["모집중"], deadline: "2026-03-27", createdAt: "2026-02-12", region: "쿠알라룸푸르", gradeBand: "G9-G12", recruitStatus: "모집중", kind: "오프라인" },

  { id: "p16", tab: "교외대회", channel: "통계포스터대회(통계청)", title: "통계청 포스터대회 데이터 파이프라인 팀", summary: "공공데이터 수집-정제-분석-시각화 작업을 역할별로 나눠 진행합니다.", popularityScore: 936, likeCount: 141, commentCount: 33, tags: ["추천", "인기"], deadline: "2026-03-10", createdAt: "2026-02-23", region: "서울", gradeBand: "G10-G13", recruitStatus: "모집중", kind: "하이브리드" },
  { id: "p17", tab: "교외대회", channel: "엔지니어링산업경진대회(산업통상자원부)", title: "엔지니어링 경진대회 문제해결 트랙", summary: "산업 문제를 정의하고 프로토타입 아이디어를 발표 자료로 완성합니다.", popularityScore: 821, likeCount: 110, commentCount: 26, tags: ["인기", "마감임박"], deadline: "2026-03-03", createdAt: "2026-02-24", region: "부산", gradeBand: "G11-G13", recruitStatus: "마감임박", kind: "오프라인" },
  { id: "p18", tab: "교외대회", channel: "통계포스터대회(통계청)", title: "통계포스터대회 디자인 파트너 모집", summary: "분석 결과를 전달력 높은 인포그래픽으로 시각화할 멤버를 찾습니다.", popularityScore: 472, likeCount: 53, commentCount: 10, tags: ["모집중", "디자인"], deadline: "2026-03-24", createdAt: "2026-02-11", region: "대전", gradeBand: "G10-G12", recruitStatus: "모집중", kind: "온라인" },

  { id: "p19", tab: "공인시험", channel: "SAT", title: "SAT Math 780+ 집중반", summary: "오답 패턴을 기반으로 주 3회 타임어택 풀이와 해설 세션을 진행합니다.", popularityScore: 1003, likeCount: 166, commentCount: 38, tags: ["추천", "인기"], deadline: "2026-03-07", createdAt: "2026-02-24", region: "LA", gradeBand: "G10-G12", recruitStatus: "모집중", kind: "온라인" },
  { id: "p20", tab: "공인시험", channel: "TOEFL", title: "TOEFL Speaking 피드백 챌린지", summary: "템플릿 암기 대신 논리 전개를 강화하는 2주 챌린지형 스터디입니다.", popularityScore: 688, likeCount: 82, commentCount: 19, tags: ["모집중"], deadline: "2026-03-16", createdAt: "2026-02-18", region: "시드니", gradeBand: "G9-G12", recruitStatus: "모집중", kind: "온라인" },
  { id: "p21", tab: "공인시험", channel: "AP", title: "AP Calculus BC 실전 모의고사", summary: "주차별 모의고사와 채점 루브릭 공유로 취약 단원을 집중 보강합니다.", popularityScore: 746, likeCount: 96, commentCount: 22, tags: ["인기", "모집중"], deadline: "2026-03-14", createdAt: "2026-02-20", region: "상하이", gradeBand: "G11-G13", recruitStatus: "모집중", kind: "온라인" },
  { id: "p22", tab: "공인시험", channel: "IB", title: "IB EE 초안 코호트", summary: "Extended Essay 초안 리뷰와 인용 규칙 교정을 함께 진행합니다.", popularityScore: 592, likeCount: 70, commentCount: 14, tags: ["연구", "모집중"], deadline: "2026-03-21", createdAt: "2026-02-17", region: "홍콩", gradeBand: "G11-G13", recruitStatus: "모집중", kind: "하이브리드" },
  { id: "p23", tab: "공인시험", channel: "TOPIK", title: "TOPIK 고급 쓰기 첨삭 스터디", summary: "서론-본론-결론 구조 훈련과 표현 다양화 연습을 병행합니다.", popularityScore: 431, likeCount: 48, commentCount: 9, tags: ["모집중"], deadline: "2026-03-29", createdAt: "2026-02-10", region: "도쿄", gradeBand: "G9-G13", recruitStatus: "모집중", kind: "온라인" },
  { id: "p24", tab: "공인시험", channel: "SAT", title: "SAT Reading 지문 분류법 워크숍", summary: "문학/사회/과학 지문별 핵심 신호를 빠르게 잡는 전략을 훈련합니다.", popularityScore: 658, likeCount: 79, commentCount: 18, tags: ["모집중", "워크숍"], deadline: "2026-03-26", createdAt: "2026-02-12", region: "밴쿠버", gradeBand: "G9-G11", recruitStatus: "모집중", kind: "온라인" },
];
