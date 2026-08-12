import Link from "next/link";
import { cookies } from "next/headers";
import { Home, ChevronRight, Search, ChevronDown, Plus } from "lucide-react";
import { COURSES } from "@/lib/course/content";
import { BC } from "@/lib/course/theme";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import CourseCard from "@/components/course/CourseCard";
import CustomCourseCards from "./CustomCourseCards";

export const metadata = { title: "내 강의 · 우아재" };

export default async function CourseDashboardPage() {
  let isAdmin = false;
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) {
      const session = await verifySessionToken(token);
      isAdmin = session?.role === "ADMIN";
    }
  } catch {
    isAdmin = false;
  }

  return (
    <div className="w-full">
      {/* 라이트 헤더 */}
      <div className="w-full border-b" style={{ background: "#ECF1EC", borderColor: "#DAE4DB" }}>
        <div className="mx-auto max-w-5xl px-4 py-9 md:px-6">
          <h1 className="text-[26px] font-extrabold" style={{ color: BC.ink }}>내 강의</h1>
          <nav className="mt-2 flex items-center gap-1.5 text-[13.5px]" style={{ color: BC.meta }}>
            <Home size={14} />
            <ChevronRight size={13} style={{ color: "#b9c0c6" }} />
            <span>우아재</span>
            <ChevronRight size={13} style={{ color: "#b9c0c6" }} />
            <span style={{ color: BC.sub }}>내 강의</span>
          </nav>
        </div>
      </div>

      {/* 코스 개요 패널 */}
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <section className="rounded-[6px] border p-5 md:p-6" style={{ borderColor: BC.borderCard }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-bold" style={{ color: BC.ink }}>코스 개요</h2>
            {isAdmin ? (
              <Link href="/course/new" className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[14px] font-bold text-white" style={{ background: "#8C6E59" }}>
                <Plus size={15} /> 강좌 개설
              </Link>
            ) : null}
          </div>
          <div className="mt-1 h-0.5 w-14 rounded" style={{ background: BC.accent }} />

          {/* 필터 바 */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <FilterButton label="전체" />
            <div className="flex items-center gap-2 rounded-[4px] border px-3 py-1.5" style={{ borderColor: "#e0e2e6" }}>
              <Search size={15} style={{ color: BC.meta }} />
              <input placeholder="검색" className="w-40 bg-transparent text-[14px] outline-none" style={{ color: BC.ink }} disabled />
            </div>
            <FilterButton label="이름순 정렬" />
            <FilterButton label="카드 보기" />
          </div>

          {/* 카드 그리드 */}
          <div className="mt-6 flex flex-wrap gap-6">
            {COURSES.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
            <CustomCourseCards />
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-[14px] transition hover:border-[#8C6E59]"
      style={{ borderColor: "#e0e2e6", color: BC.sub }}
    >
      {label} <ChevronDown size={14} />
    </button>
  );
}
