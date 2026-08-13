import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COURSES } from "@/lib/course/content";
import { isUserEnrolled } from "@/lib/enrollment-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 강좌 · 우아재" };

const BROWN = "#8C6E59";
const INK = "#2C2823";
const NUM = "#B58F72";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Entry = { id: string; title: string; subtitle: string; classDays?: string; note: string; href: string; cta: string; manageHref?: string };

export default async function MyCoursesPage() {
  const user = await requireUser("/login?next=/my-courses");
  const role = user.role;
  const staff = role === "ADMIN" || role === "FACILITATOR";
  const isParent = role === "PARENT";

  let childIds: string[] = [];
  if (isParent) {
    const links = await prisma.parentChildLink.findMany({ where: { parentUserId: user.id, status: "APPROVED" }, select: { childUserId: true } });
    childIds = links.map((l) => l.childUserId);
  }

  // 모든 강좌를 보여주되, 각 강좌마다 역할·수강 상태에 맞는 안내/액션을 붙인다(서재 + 내 강좌 통합).
  const entries: Entry[] = [];
  for (const c of COURSES) {
    const base = { id: c.id, title: c.title, subtitle: c.subtitle, classDays: c.classDays };
    if (staff) {
      entries.push({ ...base, note: role === "ADMIN" ? "관리자 · 전체 접근" : "담당 · 퍼실리테이터", href: `/course/${c.id}/learn`, cta: "강의실 입장", manageHref: `/course/${c.id}/attendance` });
    } else if (isParent) {
      let anyChild = false;
      for (const cid of childIds) {
        if (await isUserEnrolled(c.id, cid)) { anyChild = true; break; }
      }
      entries.push(
        anyChild
          ? { ...base, note: "자녀 수강 중", href: `/course/${c.id}/learn`, cta: "강의실 입장" }
          : { ...base, note: "자녀 미수강", href: `/course/${c.id}`, cta: "강좌 보기" }
      );
    } else {
      const enrolled = await isUserEnrolled(c.id, user.id);
      entries.push(
        enrolled
          ? { ...base, note: "수강 중", href: `/course/${c.id}/learn`, cta: "강의실 입장" }
          : { ...base, note: "미수강", href: `/course/${c.id}`, cta: "수강신청 · 보기" }
      );
    }
  }

  const pageTitle = staff ? "강좌 관리" : "내 강좌";
  const pageDesc = staff
    ? "전체 강좌를 관리합니다. 강의실 입장, 출석·이수 관리를 할 수 있습니다."
    : isParent
      ? "자녀가 수강 중인 강좌에 입장하거나, 강좌를 둘러볼 수 있습니다. 진도는 ‘자녀 학습 현황’에서 볼 수 있어요."
      : "수강 중인 강좌에 입장하거나, 새 강좌를 둘러보고 수강신청할 수 있습니다.";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-6">
      <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.24em", color: NUM }}>WOO AH JAE · 서재</p>
      <h1 className="mt-3 font-normal" style={{ ...serif, color: INK, fontSize: "clamp(26px, 3.4vw, 34px)", letterSpacing: "-0.02em" }}>{pageTitle}</h1>
      <p className="mt-2 text-[14px] leading-6" style={{ color: SUB }}>{pageDesc}</p>

      <div className="mt-4 h-px w-full" style={{ background: LINE }} />

      {entries.length === 0 ? (
        <p className="py-16 text-center text-[15px]" style={{ color: SUB }}>준비 중인 강좌가 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border p-4 transition hover:border-[#8C6E59]" style={{ borderColor: LINE }}>
              <div className="min-w-0">
                <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#F1EADF", color: BROWN }}>{e.note}</span>
                <p className="mt-1.5 truncate text-[17px] font-semibold" style={{ ...serif, color: INK }}>{e.title}</p>
                <p className="truncate text-[13px]" style={{ color: SUB }}>{e.subtitle}</p>
                {e.classDays ? <p className="mt-0.5 truncate text-[12px]" style={{ color: BROWN }}>{e.classDays}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {e.manageHref ? (
                  <Link href={e.manageHref} className="inline-flex items-center rounded-[8px] border px-4 py-2.5 text-[14px] font-semibold transition hover:opacity-90" style={{ borderColor: BROWN, color: BROWN, ...serif }}>
                    출석·이수 관리
                  </Link>
                ) : null}
                <Link href={e.href} className="inline-flex items-center rounded-[8px] px-5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90" style={{ background: BROWN, ...serif }}>
                  {e.cta}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
