export const BOARD_CHANNELS = [
  {
    communityKey: "exam-community",
    slug: "study-admission",
    name: "학습+입시 정보 공유",
    description: "학습법과 입시 정보를 공유하는 채널",
    sortOrder: 1,
  },
  {
    communityKey: "exam-community",
    slug: "talk",
    name: "이야기 나눠요",
    description: "자유롭게 경험과 일상을 나누는 채널",
    sortOrder: 2,
  },
] as const;

export type BoardChannelSlug = (typeof BOARD_CHANNELS)[number]["slug"];

export const BOARD_SORTS = [
  { value: "latest", label: "최신순" },
  { value: "views", label: "조회순" },
  { value: "likes", label: "추천순" },
  { value: "comments", label: "댓글많은순" },
] as const;

export const BOARD_CATEGORY_TAGS = ["질문", "정보", "후기", "자료", "잡담"] as const;

export function isBoardChannelSlug(value: string): value is BoardChannelSlug {
  return BOARD_CHANNELS.some((x) => x.slug === value);
}

export function getBoardChannelMeta(slug: string) {
  return BOARD_CHANNELS.find((x) => x.slug === slug) ?? null;
}
