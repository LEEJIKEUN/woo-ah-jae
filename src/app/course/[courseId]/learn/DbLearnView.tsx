import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { DbCourse } from "@/lib/course/db-course";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

/** DB 강좌 강의실(1단계) — 커리큘럼 읽기뷰. 게시판·멘토링·출석은 이후 단계. */
export default function DbLearnView({ course }: { course: DbCourse }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-6">
      <Link href={`/course/${course.slug}`} className="mb-2 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: BROWN }}>
        <ChevronLeft size={14} /> 강좌 소개
      </Link>
      <h1 className="text-[26px] font-normal" style={{ ...serif, color: INK }}>{course.title}</h1>
      {course.subtitle ? <p className="mt-1 text-[14px]" style={{ color: SUB }}>{course.subtitle}</p> : null}

      <div className="mt-6 space-y-4">
        {course.modules.length === 0 ? (
          <p className="rounded-[12px] border py-10 text-center text-[14px]" style={{ borderColor: CARD, color: SUB }}>아직 등록된 차시가 없습니다.</p>
        ) : (
          course.modules.map((m, mi) => (
            <section key={m.id ?? mi} className="rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
              <div className="border-b px-5 py-3.5" style={{ borderColor: CARD }}>
                <p className="text-[15px] font-bold" style={{ color: INK }}>{m.label || `${mi + 1}주차`}</p>
              </div>
              <ul className="divide-y" style={{ borderColor: CARD }}>
                {m.lessons.length === 0 ? (
                  <li className="px-5 py-4 text-[13px]" style={{ color: SUB }}>차시가 없습니다.</li>
                ) : (
                  m.lessons.map((l, li) => (
                    <li key={l.id ?? li} className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: PANEL, color: BROWN }}>{li + 1}</span>
                        <p className="text-[14.5px] font-semibold" style={{ color: INK }}>{l.title || "제목 없음"}</p>
                        {l.kind === "assignment" ? <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "#FBF6EC", color: BROWN }}>과제</span> : null}
                        {l.scheduleLabel ? <span className="ml-auto text-[12px]" style={{ color: SUB }}>{l.scheduleLabel}</span> : null}
                      </div>
                      {l.body ? <p className="mt-2 whitespace-pre-line pl-8 text-[14px] leading-7" style={{ color: BODY }}>{l.body}</p> : null}
                    </li>
                  ))
                )}
              </ul>
            </section>
          ))
        )}
      </div>

      <p className="mt-6 rounded-[10px] px-4 py-3 text-center text-[12.5px]" style={{ background: PANEL, color: SUB, border: `1px solid ${LINE}` }}>
        게시판·멘토링·출석 기능은 준비 중입니다.
      </p>
    </main>
  );
}
