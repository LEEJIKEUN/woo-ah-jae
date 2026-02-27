import { CategoryTab } from "@/lib/categoryConfig";

type KeywordContext = {
  tab?: string;
  channel?: string;
  title?: string;
  summary?: string;
};

const TAB_KEYWORD_MAP: Record<CategoryTab, string> = {
  교과: "students studying classroom desk",
  창체: "students collaboration planning",
  교내대회: "student competition preparation",
  교외대회: "academic contest teamwork",
  공인시험: "exam preparation study desk",
};

const CHANNEL_KEYWORD_MAP: Record<string, string> = {
  "교과/수학": "math studying notebook",
  "교과/영어": "english study desk",
  "교과/과학": "science experiment lab",
  "교과/사회": "social studies discussion",
  "교과/국어": "korean language reading desk",
  "교과/제2외국어": "foreign language learning classroom",
  "교과/미술": "art class drawing table",
  "교과/음악": "music class sheet and piano",
  "교과/체육": "student sports training",

  "창체/자율활동": "student activity planning board",
  "창체/진로활동": "career planning students",
  "창체/동아리 활동": "student club meeting",
  "창체/공동체 기여 활동": "community service students teamwork",

  "교내대회/MUN": "model united nations conference",
  "교내대회/통계관련 대회": "statistics competition poster presentation",
  "교내대회/수학 관련 대회": "math olympiad students solving",
  "교내대회/정보 관련 대회": "coding competition students laptop",
  "교내대회/소논문 관련 대회": "student research paper discussion",
  "교내대회/스피치 관련 대회": "student speech contest stage",

  "교외대회/통계포스터대회(통계청)": "data analysis poster presentation",
  "교외대회/엔지니어링산업경진대회(산업통상자원부)": "engineering competition prototype students",

  "공인시험/AP": "ap exam study books",
  "공인시험/IB": "ib diploma studying desk",
  "공인시험/SAT": "sat exam studying",
  "공인시험/TOEFL": "toefl studying",
  "공인시험/TOPIK": "korean language test studying",
};

function coerceTab(tab?: string): CategoryTab | null {
  if (!tab) return null;
  if (Object.keys(TAB_KEYWORD_MAP).includes(tab)) return tab as CategoryTab;
  return null;
}

export function buildThumbnailKeyword({ tab, channel, title, summary }: KeywordContext) {
  const safeTab = coerceTab(tab);

  if (safeTab && channel && channel !== "전체") {
    const key = `${safeTab}/${channel}`;
    if (CHANNEL_KEYWORD_MAP[key]) return CHANNEL_KEYWORD_MAP[key];
  }

  if (safeTab) return TAB_KEYWORD_MAP[safeTab];

  const text = `${title ?? ""} ${summary ?? ""}`.toLowerCase();
  if (text.includes("mun")) return CHANNEL_KEYWORD_MAP["교내대회/MUN"];
  if (text.includes("sat")) return CHANNEL_KEYWORD_MAP["공인시험/SAT"];
  if (text.includes("toefl")) return CHANNEL_KEYWORD_MAP["공인시험/TOEFL"];
  if (text.includes("math") || text.includes("수학")) return CHANNEL_KEYWORD_MAP["교과/수학"];
  if (text.includes("science") || text.includes("과학")) return CHANNEL_KEYWORD_MAP["교과/과학"];

  return "students teamwork study project";
}
