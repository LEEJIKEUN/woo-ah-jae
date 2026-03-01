import { notFound, redirect } from "next/navigation";
import ProjectCreateForm from "@/components/project/ProjectCreateForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("/login");
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      summary: true,
      description: true,
      tab: true,
      channel: true,
      thumbnailUrl: true,
      capacity: true,
      requirements: true,
      rolesNeeded: true,
      question1: true,
      question2: true,
      question3: true,
      deadline: true,
      status: true,
    },
  });

  if (!project) {
    notFound();
  }

  const canManage = user.role === "ADMIN" || project.ownerId === user.id;
  if (!canManage) {
    redirect(`/projects/${project.id}`);
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">프로젝트 수정</h1>
          <p className="text-sm text-slate-400">기존 프로젝트 정보를 수정하고 저장하세요.</p>
        </div>

        <ProjectCreateForm
          mode="edit"
          projectId={project.id}
          initialData={{
            title: project.title,
            summary: project.summary ?? "",
            description: project.description ?? "",
            tab: (project.tab ?? "교과") as "교과" | "창체" | "교내대회" | "교외대회" | "공인시험",
            channel: project.channel ?? "전체",
            thumbnailUrl: project.thumbnailUrl,
            capacity: project.capacity,
            requirements: project.requirements,
            rolesNeeded: project.rolesNeeded,
            question1: project.question1,
            question2: project.question2,
            question3: project.question3,
            deadline: project.deadline?.toISOString() ?? null,
            status: project.status,
          }}
        />
      </section>
    </main>
  );
}
