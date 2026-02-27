import { CategoryTab, PRIMARY_TABS } from "@/lib/categoryConfig";

export type MockProject = {
  id: string;
  title: string;
  summary: string;
  tab: CategoryTab;
  channel: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  popularityScore: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  targetRoles: string;
  capacity: number;
  requirements: string;
  region?: string;
  gradeBand?: string;
  status: "open" | "closed";
  kind: "온라인" | "오프라인" | "하이브리드";
  deadline?: string;
  createdAt: string;
};

const BASE_PROJECTS: Omit<
  MockProject,
  "id" | "popularityScore" | "likeCount" | "commentCount" | "createdAt" | "targetRoles" | "capacity" | "requirements"
>[] = [
  { tab: "교과", channel: "수학", title: "수학 탐구보고서 파이널 코칭", summary: "데이터 해석부터 결론 작성까지 3주 집중 트랙", tags: ["모집중", "온라인"], region: "싱가포르", gradeBand: "G10-G12", status: "open", kind: "온라인", deadline: "2026-03-12" },
  { tab: "교과", channel: "영어", title: "영어 디베이트 케이스 라이팅", summary: "주장-근거-반박 구조를 실전 템플릿으로 정리", tags: ["인기", "모집중"], region: "홍콩", gradeBand: "G9-G11", status: "open", kind: "온라인", deadline: "2026-03-09" },
  { tab: "교과", channel: "과학", title: "과학 R&E 실험설계 스터디", summary: "가설 설정과 변수 통제 설계를 팀으로 점검", tags: ["연구", "모집중"], region: "서울", gradeBand: "G10-G12", status: "open", kind: "하이브리드", deadline: "2026-03-16" },
  { tab: "교과", channel: "사회", title: "사회 이슈 브리핑 발표반", summary: "주간 국제 이슈를 5분 브리핑으로 압축", tags: ["발표", "모집중"], region: "도쿄", gradeBand: "G10-G12", status: "open", kind: "온라인", deadline: "2026-03-19" },
  { tab: "교과", channel: "국어", title: "국어 비문학 독해 실전반", summary: "시간 배분과 핵심 문장 추출법을 훈련", tags: ["문해력", "모집중"], region: "미국", gradeBand: "G9-G11", status: "open", kind: "온라인", deadline: "2026-03-14" },
  { tab: "교과", channel: "제2외국어", title: "제2외국어 발표문 클리닉", summary: "문장 정확도와 전달력을 동시에 개선", tags: ["발표", "첨삭"], region: "서울", gradeBand: "G9-G12", status: "open", kind: "오프라인", deadline: "2026-03-28" },
  { tab: "교과", channel: "미술", title: "미술 포트폴리오 스토리텔링", summary: "작품 의도와 과정 기록을 구조화", tags: ["포트폴리오"], region: "싱가포르", gradeBand: "G10-G13", status: "open", kind: "하이브리드", deadline: "2026-03-26" },
  { tab: "교과", channel: "음악", title: "음악 이론 분석 세미나", summary: "곡 분석 리포트 작성과 발표 리허설", tags: ["세미나"], region: "홍콩", gradeBand: "G9-G12", status: "closed", kind: "온라인", deadline: "2026-03-05" },

  { tab: "창체", channel: "자율활동", title: "자율활동 행사 PM 스프린트", summary: "학교 행사 운영 문서를 실무 포맷으로 제작", tags: ["운영", "모집중"], region: "서울", gradeBand: "G10-G12", status: "open", kind: "오프라인", deadline: "2026-03-20" },
  { tab: "창체", channel: "진로활동", title: "진로 인터뷰 질문지 공동 제작", summary: "전공별 질문 뱅크와 인터뷰 회고 템플릿 구축", tags: ["추천", "인기"], region: "미국", gradeBand: "G10-G13", status: "open", kind: "온라인", deadline: "2026-03-11" },
  { tab: "창체", channel: "동아리 활동", title: "동아리 운영 매뉴얼 리빌드", summary: "온보딩 체크리스트와 역할 매트릭스 정비", tags: ["운영"], region: "도쿄", gradeBand: "G9-G12", status: "open", kind: "하이브리드", deadline: "2026-03-17" },
  { tab: "창체", channel: "공동체 기여 활동", title: "공동체 기여활동 성과지표 설계", summary: "봉사활동 성과를 정량 지표로 전환", tags: ["지표", "모집중"], region: "싱가포르", gradeBand: "G10-G12", status: "open", kind: "온라인", deadline: "2026-03-22" },
  { tab: "창체", channel: "진로활동", title: "해외대학 전공 탐색 인터뷰 시리즈", summary: "선배 인터뷰를 주제별로 아카이빙", tags: ["인터뷰"], region: "홍콩", gradeBand: "G11-G13", status: "open", kind: "온라인", deadline: "2026-03-18" },
  { tab: "창체", channel: "동아리 활동", title: "AI 동아리 공동 커리큘럼 설계", summary: "6주 러닝 커리큘럼과 실습 과제 패키지 제작", tags: ["AI", "모집중"], region: "서울", gradeBand: "G9-G12", status: "open", kind: "하이브리드", deadline: "2026-03-25" },
  { tab: "창체", channel: "자율활동", title: "학생자치 예산안 작성 랩", summary: "의사결정 근거를 포함한 예산 제안서 작성", tags: ["문서작성"], region: "도쿄", gradeBand: "G10-G12", status: "closed", kind: "오프라인", deadline: "2026-03-04" },
  { tab: "창체", channel: "공동체 기여 활동", title: "지역사회 협업 프로젝트 매칭", summary: "학교 밖 기관과 협업 가능한 팀 매칭", tags: ["협업", "모집중"], region: "미국", gradeBand: "G9-G13", status: "open", kind: "하이브리드", deadline: "2026-03-30" },

  { tab: "교내대회", channel: "MUN", title: "MUN 의제 리서치 집중반", summary: "포지션 페이퍼와 스피치 리허설 동시 진행", tags: ["인기", "마감임박"], region: "홍콩", gradeBand: "G10-G13", status: "open", kind: "하이브리드", deadline: "2026-03-01" },
  { tab: "교내대회", channel: "통계관련 대회", title: "통계대회 포스터 교내 예선반", summary: "데이터 스토리라인부터 포스터 완성까지", tags: ["데이터", "모집중"], region: "싱가포르", gradeBand: "G10-G12", status: "open", kind: "온라인", deadline: "2026-03-13" },
  { tab: "교내대회", channel: "수학 관련 대회", title: "수학경시 대비 문제해결 랩", summary: "상위권 난도 문제 풀이와 피드백", tags: ["문제풀이"], region: "서울", gradeBand: "G9-G12", status: "open", kind: "오프라인", deadline: "2026-03-21" },
  { tab: "교내대회", channel: "정보 관련 대회", title: "정보대회 알고리즘 타임어택", summary: "기출 풀이 + 팀 페어디버깅 세션", tags: ["인기", "모집중"], region: "도쿄", gradeBand: "G9-G12", status: "open", kind: "온라인", deadline: "2026-03-06" },
  { tab: "교내대회", channel: "소논문 관련 대회", title: "소논문 대회 초록 피드백 라운드", summary: "연구질문-방법론 정합성 집중 점검", tags: ["연구", "모집중"], region: "미국", gradeBand: "G11-G13", status: "open", kind: "온라인", deadline: "2026-03-24" },
  { tab: "교내대회", channel: "스피치 관련 대회", title: "스피치 대회 스크립트 코칭", summary: "오프닝과 클로징 설득 포인트 강화", tags: ["발표"], region: "홍콩", gradeBand: "G9-G12", status: "open", kind: "오프라인", deadline: "2026-03-27" },
  { tab: "교내대회", channel: "MUN", title: "MUN 반박전략 집중 클리닉", summary: "Cross-examination 대응 문장 템플릿 훈련", tags: ["토론"], region: "싱가포르", gradeBand: "G10-G13", status: "closed", kind: "온라인", deadline: "2026-03-03" },
  { tab: "교내대회", channel: "정보 관련 대회", title: "교내 해커톤 아이디어 검증반", summary: "문제 정의와 MVP 기획서 완성", tags: ["해커톤", "모집중"], region: "서울", gradeBand: "G10-G12", status: "open", kind: "하이브리드", deadline: "2026-03-29" },

  { tab: "교외대회", channel: "통계포스터대회(통계청)", title: "통계포스터대회(통계청) 합동 준비", summary: "공공데이터 분석부터 포스터 시각화까지", tags: ["추천", "모집중"], region: "서울", gradeBand: "G10-G13", status: "open", kind: "하이브리드", deadline: "2026-03-10" },
  { tab: "교외대회", channel: "엔지니어링산업경진대회(산업통상자원부)", title: "엔지니어링산업경진대회 설계 트랙", summary: "문제정의-해결안-발표자료 원스톱 제작", tags: ["마감임박"], region: "미국", gradeBand: "G11-G13", status: "open", kind: "오프라인", deadline: "2026-03-03" },
  { tab: "교외대회", channel: "통계포스터대회(통계청)", title: "통계포스터 디자인 파트너 매칭", summary: "분석 결과를 전달력 높은 시각자료로 정리", tags: ["디자인", "모집중"], region: "도쿄", gradeBand: "G10-G12", status: "open", kind: "온라인", deadline: "2026-03-23" },
  { tab: "교외대회", channel: "엔지니어링산업경진대회(산업통상자원부)", title: "엔지니어링 발표 스토리라인 워크숍", summary: "기술 설명을 심사위원 관점으로 재구성", tags: ["발표"], region: "홍콩", gradeBand: "G11-G13", status: "open", kind: "하이브리드", deadline: "2026-03-18" },
  { tab: "교외대회", channel: "통계포스터대회(통계청)", title: "통계청 포스터 데이터 검증 세션", summary: "분석 가정과 결론 타당성 체크리스트 적용", tags: ["검증"], region: "싱가포르", gradeBand: "G10-G13", status: "closed", kind: "온라인", deadline: "2026-03-05" },
  { tab: "교외대회", channel: "엔지니어링산업경진대회(산업통상자원부)", title: "경진대회 프로토타입 리뷰 데이", summary: "시제품 시연과 피드백 라운드 운영", tags: ["프로토타입", "모집중"], region: "서울", gradeBand: "G11-G13", status: "open", kind: "오프라인", deadline: "2026-03-26" },
  { tab: "교외대회", channel: "통계포스터대회(통계청)", title: "통계청 대회 초안 스토리 편집반", summary: "포스터 문장 밀도와 메시지 흐름 개선", tags: ["편집"], region: "미국", gradeBand: "G10-G12", status: "open", kind: "온라인", deadline: "2026-03-31" },
  { tab: "교외대회", channel: "엔지니어링산업경진대회(산업통상자원부)", title: "산업 데이터 기반 설계 검토회", summary: "데이터 근거를 갖춘 설계안 리뷰", tags: ["설계", "모집중"], region: "도쿄", gradeBand: "G11-G13", status: "open", kind: "하이브리드", deadline: "2026-03-28" },

  { tab: "공인시험", channel: "SAT", title: "SAT Math 780+ 타임어택반", summary: "오답 패턴 기반 고난도 문제 집중 훈련", tags: ["TOP", "모집중"], region: "미국", gradeBand: "G10-G12", status: "open", kind: "온라인", deadline: "2026-03-07" },
  { tab: "공인시험", channel: "TOEFL", title: "TOEFL Speaking 2주 챌린지", summary: "템플릿 암기 대신 논리 전개력 강화", tags: ["인기", "모집중"], region: "도쿄", gradeBand: "G9-G12", status: "open", kind: "온라인", deadline: "2026-03-16" },
  { tab: "공인시험", channel: "AP", title: "AP Calculus BC 모의고사 코호트", summary: "루브릭 채점과 취약단원 리커버리 운영", tags: ["모집중"], region: "싱가포르", gradeBand: "G11-G13", status: "open", kind: "온라인", deadline: "2026-03-14" },
  { tab: "공인시험", channel: "IB", title: "IB EE 초안 집중 피드백", summary: "EE 구조와 인용 규칙을 단계별 점검", tags: ["연구", "모집중"], region: "홍콩", gradeBand: "G11-G13", status: "open", kind: "하이브리드", deadline: "2026-03-22" },
  { tab: "공인시험", channel: "TOPIK", title: "TOPIK 고급 쓰기 첨삭 스터디", summary: "문단 구성력과 문체 다양화 집중 개선", tags: ["첨삭"], region: "서울", gradeBand: "G9-G13", status: "open", kind: "온라인", deadline: "2026-03-29" },
  { tab: "공인시험", channel: "SAT", title: "SAT Reading 정답근거 추적반", summary: "지문 근거 찾기 루틴으로 정확도 향상", tags: ["리딩"], region: "미국", gradeBand: "G9-G11", status: "open", kind: "온라인", deadline: "2026-03-24" },
  { tab: "공인시험", channel: "AP", title: "AP Physics C 문제풀이 캠프", summary: "서술형 풀이 전개와 오답 리빌드", tags: ["물리", "모집중"], region: "홍콩", gradeBand: "G11-G13", status: "closed", kind: "오프라인", deadline: "2026-03-08" },
  { tab: "공인시험", channel: "TOEFL", title: "TOEFL Reading 속독 워크숍", summary: "문단별 핵심문장 추출 루틴 훈련", tags: ["리딩", "모집중"], region: "서울", gradeBand: "G10-G12", status: "open", kind: "하이브리드", deadline: "2026-03-27" },
];

const regions = ["서울", "싱가포르", "홍콩", "도쿄", "미국"] as const;
const grades = ["G9-G11", "G10-G12", "G11-G13"] as const;
const targetRoleSamples = [
  "리서치 담당 2명, 발표 담당 1명",
  "문서 작성 1명, 데이터 분석 2명",
  "문제풀이 리더 1명, 피드백 파트너 2명",
  "디자인/시각화 1명, 발표 보조 1명",
];
const requirementSamples = [
  "주 2회 참여 가능, 기본 과제 제출",
  "관련 과목 기초 개념 이해",
  "팀 협업 툴 사용 가능",
  "기한 내 문서 피드백 참여",
];

function dateByOffset(dayOffset: number) {
  const d = new Date(Date.UTC(2026, 1, 1 + dayOffset));
  return d.toISOString().slice(0, 10);
}

export const MOCK_PROJECTS: MockProject[] = BASE_PROJECTS.map((item, index) => {
  const popularityScore = 420 + ((index * 73) % 760);
  const likeCount = 40 + ((index * 17) % 160);
  const commentCount = 6 + ((index * 7) % 42);

  return {
    ...item,
    id: `m${String(index + 1).padStart(2, "0")}`,
    popularityScore,
    likeCount,
    commentCount,
    targetRoles: targetRoleSamples[index % targetRoleSamples.length],
    capacity: 4 + (index % 4),
    requirements: requirementSamples[index % requirementSamples.length],
    createdAt: dateByOffset((index * 3) % 29),
    region: item.region ?? regions[index % regions.length],
    gradeBand: item.gradeBand ?? grades[index % grades.length],
  };
});

if (MOCK_PROJECTS.length < 40) {
  throw new Error("MOCK_PROJECTS must contain at least 40 items");
}

export type HomeProject = {
  id: string;
  title: string;
  summary: string;
  categoryTab: CategoryTab;
  channel: string;
  posterUrl?: string;
  popularityScore: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  deadline?: string;
};

export const HOME_PROJECTS: HomeProject[] = MOCK_PROJECTS.slice(0, 24).map((item) => ({
  id: item.id,
  title: item.title,
  summary: item.summary,
  categoryTab: item.tab,
  channel: item.channel,
  posterUrl: item.posterUrl ?? item.thumbnailUrl,
  popularityScore: item.popularityScore,
  likeCount: item.likeCount,
  commentCount: item.commentCount,
  tags: item.tags,
  deadline: item.deadline,
}));

export const DEFAULT_TAB: CategoryTab = PRIMARY_TABS[0];
