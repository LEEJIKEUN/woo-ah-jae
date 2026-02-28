import { notFound } from "next/navigation";
import ApplicationsManager from "@/components/project/ApplicationsManager";
import { requireUser } from "@/lib/auth";
import { formatApplicantLabel } from "@/lib/project-dto";
import { prisma } from "@/lib/prisma";

export default async function MyProjectApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("/login");
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      ownerId: true,
      capacity: true,
      status: true,
      question1: true,
      question2: true,
      question3: true,
      applications: {
        orderBy: { createdAt: "desc" },
        include: {
          applicant: {
            select: {
              id: true,
              email: true,
              studentProfile: {
                select: { realName: true, schoolName: true, grade: true },
              },
            },
          },
        },
      },
      _count: { select: { applications: true, members: true } },
    },
  });

  if (!project) notFound();
  const canManage = user.role === "ADMIN" || project.ownerId === user.id;
  if (!canManage) {
    return (
      <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
        <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
          <p className="text-rose-300">권한이 없습니다.</p>
        </section>
      </main>
    );
  }

  const items = project.applications.map((item) => {
    const label = formatApplicantLabel(item.applicant);
    return {
      id: item.id,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      applicantIntro: item.applicantIntro,
      contact: item.contact,
      answer1: item.answer1,
      answer2: item.answer2,
      answer3: item.answer3,
      applicant: {
        id: item.applicant.id,
        email: item.applicant.email,
        ...label,
      },
    };
  });

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">지원자 관리</h1>
          <p className="text-sm text-slate-400">
            {project.title} · 모집 {project.capacity}명 · 지원 {project._count.applications}건 · 확정 {project._count.members}명
          </p>
          {user.role === "ADMIN" && project.ownerId !== user.id ? (
            <p className="text-xs text-amber-300">관리자 권한으로 다른 학생의 프로젝트를 관리 중입니다.</p>
          ) : null}
        </div>

        <ApplicationsManager
          projectId={project.id}
          questions={[project.question1, project.question2, project.question3]}
          initialItems={items}
        />
      </section>
    </main>
  );
}
