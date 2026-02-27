import Link from "next/link";
import WorkspaceHomeClient from "@/components/workspace/WorkspaceHomeClient";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser("/login");
  const { projectId } = await params;

  try {
    const access = await requireTeamMember(projectId, user.id, user.role);

    const [project, config, messages, schedules] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, title: true, summary: true, description: true },
      }),
      prisma.workspaceConfig.upsert({ where: { projectId }, update: {}, create: { projectId } }),
      prisma.chatMessage.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              studentProfile: { select: { realName: true, schoolName: true, grade: true } },
            },
          },
        },
        take: 200,
      }),
      prisma.workspaceSchedule.findMany({
        where: { projectId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: {
          creator: { select: { id: true, email: true, studentProfile: { select: { realName: true } } } },
        },
      }),
    ]);

    if (!project) {
      throw new HttpError(404, "Project not found");
    }

    return (
      <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
        <section className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <WorkspaceHomeClient
            projectId={projectId}
            canManage={access.isOwner || user.role === "ADMIN"}
            projectTitle={project.title}
            summary={project.summary ?? project.description.slice(0, 140)}
            config={{
              googleDriveUrl: config.googleDriveUrl,
              googleSheetUrl: config.googleSheetUrl,
              googleDocsUrl: config.googleDocsUrl,
              zoomMeetingUrl: config.zoomMeetingUrl,
              projectOverview: config.projectOverview,
              pinnedNotice: config.pinnedNotice,
            }}
            initialMessages={messages.map((m) => ({
              id: m.id,
              projectId: m.projectId,
              content: m.content,
              type: m.type,
              fileUrl: m.fileUrl,
              fileName: m.fileName,
              createdAt: m.createdAt.toISOString(),
              user: {
                id: m.user.id,
                email: m.user.email,
                name: m.user.studentProfile?.realName ?? m.user.email.split("@")[0],
                school: m.user.studentProfile?.schoolName ?? "학교미입력",
                grade: m.user.studentProfile?.grade ?? "학년미입력",
              },
            }))}
            initialSchedules={schedules.map((s) => ({
              id: s.id,
              title: s.title,
              note: s.note,
              date: s.date.toISOString(),
              done: s.done,
              createdAt: s.createdAt.toISOString(),
              creator: {
                id: s.creator.id,
                name: s.creator.studentProfile?.realName ?? s.creator.email.split("@")[0],
              },
            }))}
          />
        </section>
      </main>
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 403) {
      return (
        <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
          <section className="mx-auto max-w-3xl space-y-3 px-4 py-20 text-center md:px-6">
            <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
            <p className="text-sm text-slate-400">프로젝트 대표 또는 수락된 팀원만 워크스페이스에 접근할 수 있습니다.</p>
            <Link href="/me/projects" className="text-sm text-slate-200 hover:text-white">내 프로젝트 관리로 이동</Link>
          </section>
        </main>
      );
    }
    if (status === 404) {
      return (
        <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
          <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
            <h1 className="text-2xl font-bold">프로젝트를 찾을 수 없습니다.</h1>
          </section>
        </main>
      );
    }
    throw error;
  }
}
