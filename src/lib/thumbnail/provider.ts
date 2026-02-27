export type ThumbnailResult = {
  url: string;
  credit?: string;
};

type UnsplashSearchResponse = {
  results: Array<{
    urls: {
      raw: string;
    };
    user?: {
      name?: string;
    };
  }>;
};

export async function fetchUnsplashThumbnail(keyword: string): Promise<ThumbnailResult | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const endpoint = new URL("https://api.unsplash.com/search/photos");
  endpoint.searchParams.set("query", keyword);
  endpoint.searchParams.set("page", "1");
  endpoint.searchParams.set("per_page", "1");
  endpoint.searchParams.set("orientation", "landscape");
  endpoint.searchParams.set("content_filter", "high");

  const res = await fetch(endpoint.toString(), {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as UnsplashSearchResponse;
  const photo = data.results?.[0];
  if (!photo?.urls?.raw) return null;

  const imageUrl = `${photo.urls.raw}&w=900&h=600&fit=crop&auto=format&q=80`;
  const credit = photo.user?.name ? `Unsplash / ${photo.user.name}` : "Unsplash";
  return { url: imageUrl, credit };
}
