import Link from "next/link";
import { COURSES } from "@/lib/course/content";

export const metadata = { title: "서재 · 우아재" };

const BROWN = "#8C6E59";
const INK = "#2C2823";
const NUM = "#B58F72";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const serif = { fontFamily: "var(--font-serif)" } as const;

/** 우아재 서재 — 강좌 목록(서재 톤). '강좌 관리(/my-courses)'와 같은 깔끔한 리스트. */
export default function CourseCatalogPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-6">
      <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.24em", color: NUM }}>WOO AH JAE · 서재</p>
      <h1 className="mt-3 font-normal" style={{ ...serif, color: INK, fontSize: "clamp(26px, 3.4vw, 34px)", letterSpacing: "-0.02em" }}>강좌</h1>
      <p className="mt-2 text-[14px] leading-6" style={{ color: SUB }}>
        우아재 서재의 강좌입니다. 강좌를 열어 소개와 커리큘럼을 확인하고 수강신청하세요.
      </p>

      <div className="mt-4 h-px w-full" style={{ background: LINE }} />

      {COURSES.length === 0 ? (
        <p className="py-16 text-center text-[15px]" style={{ color: SUB }}>준비 중인 강좌가 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {COURSES.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border p-4 transition hover:border-[#8C6E59]" style={{ borderColor: LINE }}>
              <div className="min-w-0">
                <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#F1EADF", color: BROWN }}>{c.category ?? c.programme}</span>
                <p className="mt-1.5 truncate text-[17px] font-semibold" style={{ ...serif, color: INK }}>{c.title}</p>
                <p className="truncate text-[13px]" style={{ color: SUB }}>{c.subtitle}</p>
                {c.classDays ? <p className="mt-0.5 truncate text-[12px]" style={{ color: BROWN }}>{c.classDays}</p> : null}
              </div>
              <Link
                href={`/course/${c.id}`}
                className="inline-flex shrink-0 items-center rounded-[8px] px-5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90"
                style={{ background: BROWN, ...serif }}
              >
                강좌 보기
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
