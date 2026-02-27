import CategoryPageClient from "@/components/category/CategoryPageClient";
import { redirect } from "next/navigation";

type SearchParams = {
  tab?: string;
  channel?: string;
  sort?: string;
  query?: string;
  search?: string;
  date?: string;
  grade?: string;
  recruit?: string;
  kind?: string;
};

export default async function CategoryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  if (!resolved.sort) {
    const params = new URLSearchParams();
    if (resolved.tab) params.set("tab", resolved.tab);
    if (resolved.channel) params.set("channel", resolved.channel);
    if (resolved.query) params.set("query", resolved.query);
    if (resolved.search) params.set("query", resolved.search);
    if (resolved.date) params.set("date", resolved.date);
    if (resolved.grade) params.set("grade", resolved.grade);
    if (resolved.recruit) params.set("recruit", resolved.recruit);
    if (resolved.kind) params.set("kind", resolved.kind);
    params.set("sort", "popular");
    redirect(`/category?${params.toString()}`);
  }

  return (
    <CategoryPageClient
      tab={resolved.tab ?? "교과"}
      channel={resolved.channel ?? "전체"}
      sort={resolved.sort ?? "popular"}
      query={resolved.query ?? resolved.search ?? ""}
      date={resolved.date ?? "all"}
      grade={resolved.grade ?? "all"}
      recruit={resolved.recruit ?? "all"}
      kind={resolved.kind ?? "all"}
    />
  );
}
