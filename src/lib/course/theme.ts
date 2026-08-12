/**
 * IB 워크숍 스타일 라이트 테마 토큰.
 * 값은 /Users/skye/Desktop/ib-ref/spec.md (onlinepl.ibo.org 실측)을 기준으로 함.
 * 전역 globals.css(다크)와 분리 — 강의 포털에서만 사용.
 */
export const IB = {
  navy: "#004A8D", // 브랜드 프라이머리(버튼·링크·히어로·진도 fill)
  navyDark: "#00427E", // 푸터
  navyDeep: "#003A6E",
  pageBg: "#E8E8E8", // 콘텐츠 바깥 배경
  surface: "#FFFFFF", // 카드·콘텐츠 영역
  ink: "#242027", // 제목 텍스트
  body: "#2b2b31", // 본문 텍스트
  muted: "#6B7280", // 보조 텍스트
  border: "#DEE2E6", // 탭·구분선
  cardBorder: "rgba(0,0,0,0.10)",
  railFrom: "#005AAC",
  railTo: "#003A6E",
  bannerFrom: "#009AD5", // 섹션 배너 그라디언트
  bannerTo: "#70D9FB",
  heroFrom: "#0A5AA0",
  heroTo: "#004A8D",
  tintViolet: "rgba(63,55,201,0.08)", // resource/page 아이콘 칩
  tintTeal: "rgba(21,122,110,0.08)", // forum/자료 아이콘 칩
  tintAmber: "rgba(214,153,94,0.12)", // assignment 아이콘 칩
  doneBg: "#D4EDDA",
  doneText: "#145423",
  warnBg: "#FFF3CD",
  warnText: "#856404",
  darkPill: "#343A40", // 포럼 unread pill
} as const;

/** 섹션 배너 그라디언트 (좌→우 하늘색) */
export const bannerGradient = `linear-gradient(to right, ${IB.bannerFrom}, ${IB.bannerTo})`;
/** 히어로 밴드 그라디언트 (남색) */
export const heroGradient = `linear-gradient(135deg, ${IB.heroFrom}, ${IB.heroTo})`;
/** 좌측 아이콘 레일 (세로 남색) */
export const railGradient = `linear-gradient(${IB.railFrom}, ${IB.railTo})`;

export const CARD_SHADOW = "0 3px 10px rgba(0,0,0,0.06)";

/**
 * 부스트코스(boostcourse) 스타일 토큰 — 강좌별 홈 리모델링용.
 * 레퍼런스: /Users/skye/Desktop/boostcourse-ref/spec.md (실측).
 * 화이트/시안 플랫 톤. IB(남색) 와 별개.
 */
export const BC = {
  accent: "#8C6E59", // 청자(celadon) — 히어로·활성 보더·불릿·hover
  accentInk: "#6B5342", // 진한 청자(버튼·텍스트 대비)
  gnb: "#2C2823", // 상단 GNB(먹빛 현판)
  gnbDark: "#241f18", // GNB 좌측 로고 영역
  footer: "#2C2823",
  ink: "#2C2823", // 본문(먹)
  sub: "#6F665A", // 부 텍스트
  meta: "#9A8F7D", // 메타
  borderSide: "#E4DBC7", // 한지 라인
  borderCard: "#EAE2D2", // 카드 보더
  tile: "#F0E8D7", // 아이콘 타일(한지)
  tileIcon: "#B8AD97",
  white: "#FFFFFF",
} as const;

/** 청자 히어로 그라디언트 */
export const bcHeroGradient = `linear-gradient(135deg, #A98B6E, #6B5342)`;
