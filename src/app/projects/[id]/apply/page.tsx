import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import ApplyForm from "@/components/project/ProjectApplyForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("/login");
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      ownerId: true,
      status: true,
      question1: true,
      question2: true,
      question3: true,
    },
  });

  if (!project) {
    redirect("/projects");
  }

  if (project.ownerId === user.id) {
    redirect(`/projects/${project.id}`);
  }

  if (project.status === ProjectStatus.CLOSED) {
    redirect(`/projects/${project.id}`);
  }

  const existing = await prisma.application.findUnique({
    where: { projectId_applicantId: { projectId: project.id, applicantId: user.id } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/projects/${project.id}`);
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
        <div>
          <h1 className="text-3xl font-bold">지원서 작성</h1>
          <p className="text-sm text-slate-400">{project.title}</p>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4 text-sm text-slate-300">
          <p>지원자: {user.studentProfile?.schoolName ?? "학교미입력"} · {user.studentProfile?.grade ?? "학년미입력"} · {user.studentProfile?.realName ?? user.email.split("@")[0]}</p>
          <p className="mt-1 text-xs text-slate-400">기본 정보는 프로필에서 자동 표시됩니다.</p>
        </div>

        <ApplyForm
          projectId={project.id}
          questions={[project.question1, project.question2, project.question3]}
        />

        <Link href={`/projects/${project.id}`} className="inline-block text-sm text-slate-300 hover:text-white">프로젝트로 돌아가기</Link>
      </section>
    </main>
  );
}
