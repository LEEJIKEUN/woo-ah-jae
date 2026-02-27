type ThumbnailCacheValue = {
  url: string;
  credit?: string;
  createdAt: number;
};

const projectCache = new Map<string, ThumbnailCacheValue>();
const keywordCache = new Map<string, ThumbnailCacheValue>();

export function getProjectThumbnail(projectId: string) {
  return projectCache.get(projectId) ?? null;
}

export function setProjectThumbnail(projectId: string, value: ThumbnailCacheValue) {
  projectCache.set(projectId, value);
}

export function getKeywordThumbnail(keyword: string) {
  return keywordCache.get(keyword) ?? null;
}

export function setKeywordThumbnail(keyword: string, value: ThumbnailCacheValue) {
  keywordCache.set(keyword, value);
}
