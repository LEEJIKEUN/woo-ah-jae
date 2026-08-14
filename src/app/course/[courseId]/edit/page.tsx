import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { loadDbCourse } from "@/lib/course/db-course";
import CourseCreateForm, { type CourseInitial } from "@/app/course/new/CourseCreateForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "강좌 수정 · 우아재" };

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;

  let role: string | null = null;
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) role = (await verifySessionToken(token))?.role ?? null;
  } catch {
    role = null;
  }
  if (role !== "ADMIN") redirect(`/course/${courseId}`);

  const db = await loadDbCourse(courseId);
  if (!db) notFound(); // 하드코딩 강좌는 상세페이지의 '강좌 정보 편집'을 사용

  const initial: CourseInitial = {
    slug: db.slug,
    title: db.title,
    subtitle: db.subtitle,
    objectives: db.objectives,
    programme: db.programme,
    audience: db.audience,
    format: db.format,
    deliveryMode: db.deliveryMode,
    periodLabel: db.periodLabel,
    country: db.country,
    summary: db.summary,
    modules: db.modules.map((m) => ({ label: m.label, lessons: m.lessons.map((l) => ({ title: l.title, kind: l.kind, body: l.body })) })),
  };

  return <CourseCreateForm initial={initial} editSlug={db.slug} />;
}
