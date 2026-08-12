import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COURSES } from "@/lib/course/content";
import { isUserEnrolled } from "@/lib/enrollment-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 강의실 · 우아재" };

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const serif = { fontFamily: "var(--font-serif)" } as const;

type Entry = { id: string; title: string; subtitle: string; note: string; href: string; cta: string };

export default async function MyCoursesPage() {
  const user = await requireUser("/login?next=/my-courses");
  const role = user.role;
  const staff = role === "ADMIN" || role === "FACILITATOR";
  const isParent = role === "PARENT";

  const entries: Entry[] = [];
  if (staff) {
    for (const c of COURSES) {
      entries.push({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        note: role === "ADMIN" ? "관리자 · 전체 접근" : "담당 · 퍼실리테이터",
        href: `/course/${c.id}/learn`,
        cta: "강의실 입장",
      });
    }
  } else if (isParent) {
    const links = await prisma.parentChildLink.findMany({
      where: { parentUserId: user.id, status: "APPROVED" },
      select: { childUserId: true },
    });
    const childIds = links.map((l) => l.childUserId);
    for (const c of COURSES) {
      let anyChild = false;
      for (const cid of childIds) {
        if (await isUserEnrolled(c.id, cid)) {
          anyChild = true;
          break;
        }
      }
      if (anyChild) {
        entries.push({ id: c.id, title: c.title, subtitle: c.subtitle, note: "자녀 수강 중", href: `/course/${c.id}`, cta: "강좌 보기" });
      }
    }
  } else {
    for (const c of COURSES) {
      if (await isUserEnrolled(c.id, user.id)) {
        entries.push({ id: c.id, title: c.title, subtitle: c.subtitle, note: "수강 중", href: `/course/${c.id}/learn`, cta: "강의실 입장" });
      }
    }
  }

  const pageTitle = staff ? "강좌 관리" : "내 강의실";
  const pageDesc = staff
    ? "전체 강좌입니다. 어느 강의실이든 바로 입장해 확인·수정할 수 있습니다."
    : isParent
      ? "자녀가 수강 중인 강좌입니다. 강좌를 열어 내용을 확인할 수 있어요. 진도는 ‘자녀 학습 현황’에서 볼 수 있습니다."
      : "수강 중인 강좌입니다. 강의실에 입장해 학습을 이어가세요.";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 md:px-6">
      <h1 className="text-[26px] font-semibold" style={{ ...serif, color: INK }}>{pageTitle}</h1>
      <p className="mt-1.5 text-[14px] leading-6" style={{ color: SUB }}>{pageDesc}</p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-[8px] border p-8 text-center" style={{ borderColor: LINE }}>
          <p className="text-[15px]" style={{ color: SUB }}>
            {isParent ? "자녀가 수강 중인 강좌가 없습니다." : "아직 수강 중인 강좌가 없습니다."}
          </p>
          <Link
            href={isParent ? "/me/children" : "/course"}
            className="mt-5 inline-flex items-center rounded-[8px] px-5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90"
            style={{ background: BROWN, ...serif }}
          >
            {isParent ? "자녀 학습 현황 보기" : "전체 강좌 둘러보기"}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border p-4" style={{ borderColor: LINE }}>
              <div className="min-w-0">
                <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#F1EADF", color: BROWN }}>{e.note}</span>
                <p className="mt-1.5 truncate text-[16px] font-semibold" style={{ ...serif, color: INK }}>{e.title}</p>
                <p className="truncate text-[13px]" style={{ color: SUB }}>{e.subtitle}</p>
              </div>
              <Link
                href={e.href}
                className="inline-flex shrink-0 items-center rounded-[8px] px-5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90"
                style={{ background: BROWN, ...serif }}
              >
                {e.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
