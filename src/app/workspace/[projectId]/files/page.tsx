import Link from "next/link";
import WorkspaceFilesClient from "@/components/workspace/WorkspaceFilesClient";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceFilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser("/login");
  const { projectId } = await params;

  let forbidden = false;
  try {
    await requireTeamMember(projectId, user.id, user.role);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden) {
    return (
      <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
        <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
          <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
          <p className="mt-2 text-sm text-slate-400">프로젝트 대표 또는 수락된 팀원만 접근할 수 있습니다.</p>
        </section>
      </main>
    );
  }

  const items = await prisma.workspaceFile.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      uploader: {
        select: {
          id: true,
          email: true,
          studentProfile: { select: { realName: true, schoolName: true, grade: true } },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-5xl space-y-4 px-4 py-8 md:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">워크스페이스 자료실</h1>
          <Link href={`/workspace/${projectId}`} className="text-sm text-slate-300 hover:text-white">워크스페이스 홈</Link>
        </div>

        <WorkspaceFilesClient
          projectId={projectId}
          initialItems={items.map((item) => ({
            id: item.id,
            fileUrl: item.fileUrl,
            fileName: item.fileName,
            mimeType: item.mimeType,
            size: item.size,
            createdAt: item.createdAt.toISOString(),
            uploader: {
              id: item.uploader.id,
              name: item.uploader.studentProfile?.realName ?? item.uploader.email.split("@")[0],
              school: item.uploader.studentProfile?.schoolName ?? "학교미입력",
              grade: item.uploader.studentProfile?.grade ?? "학년미입력",
            },
          }))}
        />
      </section>
    </main>
  );
}
