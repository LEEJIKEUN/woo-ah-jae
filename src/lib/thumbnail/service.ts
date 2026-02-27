import { buildThumbnailKeyword } from "@/lib/thumbnail/keywordMap";
import {
  getKeywordThumbnail,
  getProjectThumbnail,
  setKeywordThumbnail,
  setProjectThumbnail,
} from "@/lib/thumbnail/cache";
import { fetchUnsplashThumbnail } from "@/lib/thumbnail/provider";

type GenerateInput = {
  projectId?: string;
  tab?: string;
  channel?: string;
  title?: string;
  summary?: string;
};

export async function generateThumbnailUrl(input: GenerateInput) {
  if (input.projectId) {
    const cachedByProject = getProjectThumbnail(input.projectId);
    if (cachedByProject) return cachedByProject;
  }

  const keyword = buildThumbnailKeyword(input);
  const cachedByKeyword = getKeywordThumbnail(keyword);
  if (cachedByKeyword) {
    if (input.projectId) setProjectThumbnail(input.projectId, cachedByKeyword);
    return cachedByKeyword;
  }

  let fetched: { url: string; credit?: string } | null = null;
  try {
    fetched = await fetchUnsplashThumbnail(keyword);
  } catch {
    fetched = null;
  }
  if (!fetched) return null;

  const value = {
    url: fetched.url,
    credit: fetched.credit,
    createdAt: Date.now(),
  };

  setKeywordThumbnail(keyword, value);
  if (input.projectId) setProjectThumbnail(input.projectId, value);

  return value;
}
