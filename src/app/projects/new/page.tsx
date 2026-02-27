import ProjectCreateForm from "@/components/project/ProjectCreateForm";
import { requireUser } from "@/lib/auth";

export default async function NewProjectPage() {
  await requireUser("/login");

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">내 프로젝트 만들기</h1>
          <p className="text-sm text-slate-400">프로젝트 정보를 입력하고 팀 모집을 시작하세요.</p>
        </div>

        <ProjectCreateForm />
      </section>
    </main>
  );
}
