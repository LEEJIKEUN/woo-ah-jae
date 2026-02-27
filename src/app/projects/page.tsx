import { redirect } from "next/navigation";
import ProjectsClient from "@/components/project/ProjectsClient";

type SearchParams = {
  tab?: string;
  channel?: string;
  sort?: string;
  query?: string;
  date?: string;
  grade?: string;
  recruit?: string;
  kind?: string;
};

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolved = (await searchParams) ?? {};

  if (!resolved.sort) {
    const params = new URLSearchParams();
    if (resolved.tab) params.set("tab", resolved.tab);
    if (resolved.channel) params.set("channel", resolved.channel);
    if (resolved.query) params.set("query", resolved.query);
    if (resolved.date) params.set("date", resolved.date);
    if (resolved.grade) params.set("grade", resolved.grade);
    if (resolved.recruit) params.set("recruit", resolved.recruit);
    if (resolved.kind) params.set("kind", resolved.kind);
    params.set("sort", "popular");
    redirect(`/projects?${params.toString()}`);
  }

  return (
    <ProjectsClient
      tab={resolved.tab ?? "교과"}
      channel={resolved.channel ?? "전체"}
      sort={resolved.sort ?? "popular"}
      query={resolved.query ?? ""}
      date={resolved.date ?? "all"}
      grade={resolved.grade ?? "all"}
      recruit={resolved.recruit ?? "all"}
      kind={resolved.kind ?? "all"}
    />
  );
}
