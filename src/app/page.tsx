import BrandIntro from "@/components/home/BrandIntro";
import HeroSpotlight from "@/components/home/HeroSpotlight";
import HorizontalRail from "@/components/home/HorizontalRail";
import TopTenRail from "@/components/home/TopTenRail";
import { CategoryTab, PRIMARY_TABS } from "@/lib/categoryConfig";
import { HOME_PROJECTS, HomeProject } from "@/lib/mockProjects";
import { prisma } from "@/lib/prisma";

function byCategory(items: HomeProject[], tab: CategoryTab) {
  return items.filter((item) => item.categoryTab === tab).sort(
    (a, b) => b.popularityScore - a.popularityScore
  );
}

function toCategoryTab(tab: string | null): CategoryTab {
  if (tab && PRIMARY_TABS.includes(tab as CategoryTab)) {
    return tab as CategoryTab;
  }
  return "교과";
}

export default async function Home() {
  const topStudyPosts = await prisma.boardPost.findMany({
    where: {
      status: "ACTIVE",
      boardChannel: { slug: "study-admission" },
    },
    orderBy: [{ likeCount: "desc" }, { commentCount: "desc" }, { createdAt: "desc" }],
    take: 5,
    select: {
      id: true,
      title: true,
      likeCount: true,
      commentCount: true,
    },
  });

  const dbProjects = await prisma.project.findMany({
    orderBy: [{ popularityScore: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  const dbHomeProjects: HomeProject[] = dbProjects.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary ?? item.description.slice(0, 120),
    categoryTab: toCategoryTab(item.tab),
    channel: item.channel ?? "전체",
    posterUrl: item.thumbnailUrl ?? undefined,
    popularityScore: item.popularityScore,
    likeCount: item.likeCount,
    commentCount: item.commentCount,
    tags: [item.status === "OPEN" ? "모집중" : "마감"],
    deadline: item.deadline?.toISOString().slice(0, 10),
  }));

  const mergedProjects = [...dbHomeProjects];
  const seen = new Set(mergedProjects.map((item) => item.id));
  for (const item of HOME_PROJECTS) {
    if (seen.has(item.id)) continue;
    mergedProjects.push(item);
    if (mergedProjects.length >= 24) break;
  }

  const displayProjects = mergedProjects.length ? mergedProjects : HOME_PROJECTS;
  const topTen = [...displayProjects]
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 10);

  const spotlight = topTen[0] ?? displayProjects[0];

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-6xl space-y-14 px-4 pb-10 pt-[calc(var(--header-h)+1rem)] md:px-6 md:pb-12 md:pt-[calc(var(--header-h)+1.5rem)]">
        <BrandIntro topPosts={topStudyPosts} />

        <HeroSpotlight item={spotlight} />

        <TopTenRail items={topTen} />

        <HorizontalRail title="교과" items={byCategory(displayProjects, "교과")} />
        <HorizontalRail title="창체" items={byCategory(displayProjects, "창체")} />
        <HorizontalRail title="교내대회" items={byCategory(displayProjects, "교내대회")} />
        <HorizontalRail title="교외대회" items={byCategory(displayProjects, "교외대회")} />
        <HorizontalRail title="공인시험" items={byCategory(displayProjects, "공인시험")} />
      </section>
    </main>
  );
}
