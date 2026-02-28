import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import ProjectEngagementPanel from "@/components/project/ProjectEngagementPanel";
import { prisma } from "@/lib/prisma";

function statusText(status: ProjectStatus) {
  return status === ProjectStatus.OPEN ? "모집중" : "모집 마감";
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          studentProfile: { select: { realName: true, schoolName: true, grade: true } },
        },
      },
      _count: { select: { applications: true, members: true } },
    },
  });

  if (!project) {
    notFound();
  }

  const myApplication = user
    ? await prisma.application.findUnique({
        where: {
          projectId_applicantId: {
            projectId: project.id,
            applicantId: user.id,
          },
        },
        select: { status: true },
      })
    : null;

  const myLike = user
    ? await prisma.projectLike.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        select: { id: true },
      })
    : null;

  const ownerName = project.owner.studentProfile?.realName ?? project.owner.email.split("@")[0];
  const ownerSchool = project.owner.studentProfile?.schoolName ?? "학교미입력";
  const ownerGrade = project.owner.studentProfile?.grade ?? "학년미입력";

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
        <article className="space-y-4 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-5">
          <p className="text-xs text-slate-400">{project.tab ?? "교과"} · {project.channel ?? "전체"}</p>
          <h1 className="text-3xl font-bold text-slate-100">{project.title}</h1>
          <p className="text-sm text-slate-300">{project.summary ?? project.description.slice(0, 160)}</p>
          <p className="text-sm leading-7 text-slate-200">{project.description}</p>

          <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
            <p>대표: {ownerSchool} · {ownerGrade} · {ownerName}</p>
            <p>모집 상태: {statusText(project.status)}</p>
            <p>모집 인원: {project.capacity}명 (확정 {project._count.members}명)</p>
            <p>지원서: {project._count.applications}건</p>
            <p>모집 역할: {project.rolesNeeded ?? "미지정"}</p>
            <p>조건: {project.requirements ?? "없음"}</p>
            <p>마감일: {project.deadline ? project.deadline.toISOString().slice(0, 10) : "상시"}</p>
          </div>

          <div className="space-y-2 rounded-md border border-slate-700/70 p-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">지원 질문</p>
            {[project.question1, project.question2, project.question3]
              .filter((question): question is string => !!question)
              .map((question, index) => (
                <p key={`${project.id}-q-${index}`}>{index + 1}. {question}</p>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {!user ? (
              <Link href={`/login?next=/projects/${project.id}`} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                로그인 후 신청하기
              </Link>
            ) : project.ownerId === user.id ? (
              <>
                <Link href={`/me/projects/${project.id}/applications`} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                  지원자 관리
                </Link>
                <Link href={`/workspace/${project.id}`} className="rounded-md border border-slate-500/80 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-300">
                  프로젝트 공간으로 이동
                </Link>
              </>
            ) : user.role === "ADMIN" ? (
              <Link href={`/workspace/${project.id}`} className="rounded-md border border-slate-500/80 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-300">
                관리자 권한으로 프로젝트 공간 입장
              </Link>
            ) : myApplication ? (
              <>
                <p className="rounded-md border border-slate-500/80 px-4 py-2 text-sm text-slate-200">
                  지원 완료 (상태: {myApplication.status})
                </p>
                {myApplication.status === "ACCEPTED" ? (
                  <Link href={`/workspace/${project.id}`} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                    프로젝트 공간으로 이동
                  </Link>
                ) : null}
              </>
            ) : project.status === ProjectStatus.CLOSED ? (
              <p className="rounded-md border border-rose-500/60 px-4 py-2 text-sm text-rose-300">모집 마감</p>
            ) : (
              <Link href={`/projects/${project.id}/apply`} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                신청하기(지원서 작성)
              </Link>
            )}

            <Link href="/projects" className="text-sm text-slate-300 hover:text-white">목록으로</Link>
          </div>
        </article>

        <ProjectEngagementPanel
          projectId={project.id}
          initialLikeCount={project.likeCount}
          initialCommentCount={project.commentCount}
          initialLiked={Boolean(myLike)}
          currentUserId={user?.id}
          isAdmin={user?.role === "ADMIN"}
        />
      </section>
    </main>
  );
}
