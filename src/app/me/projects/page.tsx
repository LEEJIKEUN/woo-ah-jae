import Link from "next/link";
import MyProjectsDashboard from "@/components/project/MyProjectsDashboard";
import { requireUser } from "@/lib/auth";
import { formatKstDateTime } from "@/lib/date-format";
import { toCardItem } from "@/lib/project-dto";
import { prisma } from "@/lib/prisma";

function appStatusLabel(status: "PENDING" | "ACCEPTED" | "REJECTED") {
  if (status === "ACCEPTED") return "수락";
  if (status === "REJECTED") return "거절";
  return "대기";
}

export default async function MyProjectsPage() {
  const user = await requireUser("/login");

  const [projects, appliedProjects, joinedProjects] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { applications: true, members: true } } },
    }),
    prisma.application.findMany({
      where: { applicantId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            owner: {
              select: {
                email: true,
                studentProfile: { select: { realName: true, schoolName: true, grade: true } },
              },
            },
          },
        },
      },
    }),
    prisma.projectMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "desc" },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            owner: {
              select: {
                email: true,
                studentProfile: { select: { realName: true, schoolName: true, grade: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const items = projects.map((project) => {
    const card = toCardItem(project);
    return {
      ...card,
      applicationCount: project._count.applications,
      memberCount: project._count.members,
    };
  });

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">내 프로젝트 관리</h1>
            <p className="text-sm text-slate-400">내가 만든 프로젝트와 지원 현황을 관리합니다.</p>
          </div>
          <Link href="/projects/new" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
            새 프로젝트
          </Link>
        </div>

        <MyProjectsDashboard initialItems={items} />

        <section id="applied-projects" className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">내가 지원한 프로젝트 현황</h2>
          {appliedProjects.length === 0 ? (
            <p className="text-sm text-slate-400">아직 지원한 프로젝트가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {appliedProjects.map((item) => {
                const ownerName = item.project.owner.studentProfile?.realName ?? item.project.owner.email.split("@")[0];
                const ownerSchool = item.project.owner.studentProfile?.schoolName ?? "학교미입력";
                const ownerGrade = item.project.owner.studentProfile?.grade ?? "학년미입력";

                return (
                  <article key={item.id} className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-slate-100">{item.project.title}</h3>
                        <p className="text-sm text-slate-300">{item.project.summary ?? "-"}</p>
                        <p className="text-xs text-slate-400">
                          프로젝트 대표: {ownerSchool} · {ownerGrade} · {ownerName}
                        </p>
                        <p className="text-xs text-slate-400">
                          지원 상태: {appStatusLabel(item.status)} · 제출일: {formatKstDateTime(item.createdAt)}
                        </p>
                      </div>
                      <Link
                        href={`/projects/${item.project.id}`}
                        className="rounded-md border border-slate-500/70 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300"
                      >
                        상세보기
                      </Link>
                      {item.status === "ACCEPTED" ? (
                        <Link
                          href={`/workspace/${item.project.id}`}
                          className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
                        >
                          프로젝트 공간으로 이동
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section id="joined-projects" className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">참여중인 프로젝트</h2>
          {joinedProjects.length === 0 ? (
            <p className="text-sm text-slate-400">현재 참여 확정된 프로젝트가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {joinedProjects.map((item) => {
                const ownerName = item.project.owner.studentProfile?.realName ?? item.project.owner.email.split("@")[0];
                return (
                  <article key={item.id} className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-slate-100">{item.project.title}</h3>
                        <p className="text-sm text-slate-300">{item.project.summary ?? "-"}</p>
                        <p className="text-xs text-slate-400">
                          팀 참여일: {formatKstDateTime(item.joinedAt)} · 프로젝트 상태: {item.project.status === "OPEN" ? "모집중" : "마감"}
                        </p>
                        <p className="text-xs text-slate-400">프로젝트 대표: {ownerName}</p>
                      </div>
                      <Link
                        href={`/projects/${item.project.id}`}
                        className="rounded-md border border-slate-500/70 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300"
                      >
                        상세보기
                      </Link>
                      <Link
                        href={`/workspace/${item.project.id}`}
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
                      >
                        프로젝트 공간으로 이동
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
