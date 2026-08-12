import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COURSES, completableActivityIds } from "@/lib/course/content";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { percentDone } from "@/lib/course/progress";

export const dynamic = "force-dynamic";
export const metadata = { title: "자녀 학습 현황 · 우아재" };

type ChildCourse = { courseId: string; title: string; done: number; total: number; pct: number };
type ChildView = { id: string; name: string; email: string; courses: ChildCourse[] };

async function buildChildView(childId: string, name: string, email: string): Promise<ChildView> {
  const courses: ChildCourse[] = [];
  for (const course of COURSES) {
    if (!(await isUserEnrolled(course.id, childId))) continue;
    const completable = completableActivityIds(course);
    const rows = await prisma.lessonCompletion.findMany({
      where: { userId: childId, courseId: course.id },
      select: { activityId: true },
    });
    const doneSet = new Set(rows.map((r) => r.activityId));
    const done = completable.filter((id) => doneSet.has(id)).length;
    courses.push({ courseId: course.id, title: course.title, done, total: completable.length, pct: percentDone(done, completable.length) });
  }
  return { id: childId, name, email, courses };
}

export default async function ChildrenPage() {
  const user = await requireUser("/login?next=/me/children");

  const [approved, pending] = await Promise.all([
    prisma.parentChildLink.findMany({
      where: { parentUserId: user.id, status: "APPROVED" },
      select: { child: { select: { id: true, email: true, studentProfile: { select: { realName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.parentChildLink.findMany({
      where: { parentUserId: user.id, status: "PENDING" },
      select: { child: { select: { email: true } } },
    }),
  ]);

  const children = await Promise.all(
    approved.map((l) => buildChildView(l.child.id, l.child.studentProfile?.realName ?? "자녀", l.child.email))
  );

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
        <div>
          <h1 className="text-3xl font-bold">자녀 학습 현황</h1>
          <p className="mt-1 text-sm text-slate-500">연결된 자녀의 수강 강의와 진도율을 확인할 수 있습니다.</p>
        </div>

        {pending.length > 0 ? (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            연결 대기중: {pending.map((p) => p.child.email).join(", ")} — 자녀가 계정에서 연결 요청을 수락하면 진도가 표시됩니다.
          </div>
        ) : null}

        {children.length === 0 ? (
          <div className="rounded-xl border border-slate-200/70 bg-[color:var(--surface)] p-8 text-center text-sm text-slate-500">
            아직 연결된 자녀가 없습니다.
            <br />
            자녀 이메일로 연결을 요청하고, 자녀가 수락하면 여기에 학습 현황이 표시됩니다.
          </div>
        ) : (
          <div className="space-y-5">
            {children.map((c) => (
              <section key={c.id} className="rounded-xl border border-slate-200/70 bg-[color:var(--surface)] p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: "#4E6B5A" }}>
                    {c.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">{c.name}</p>
                    <p className="text-[12px] text-slate-500">{c.email}</p>
                  </div>
                </div>

                {c.courses.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">아직 신청한 강의가 없습니다.</p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {c.courses.map((course) => (
                      <li key={course.courseId}>
                        <div className="flex items-baseline justify-between gap-3">
                          <Link href={`/course/${course.courseId}`} className="text-[14px] font-semibold text-slate-800 hover:underline">
                            {course.title}
                          </Link>
                          <span className="text-[13px] font-bold" style={{ color: "#4E6B5A" }}>
                            {course.pct}% <span className="font-normal text-slate-400">({course.done}/{course.total})</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${course.pct}%`, background: "#4E6B5A" }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
