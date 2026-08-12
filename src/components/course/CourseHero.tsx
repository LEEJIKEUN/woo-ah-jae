import Link from "next/link";
import { Home, ChevronRight, ArrowLeft } from "lucide-react";
import { heroGradient } from "@/lib/course/theme";

type Crumb = { label: string; href?: string };

/** 코스 히어로 밴드 — 남색 그라디언트 + 흰 물결 오버레이 + 제목 + 브레드크럼. */
export default function CourseHero({
  title,
  crumbs,
  backHref,
  backLabel = "코스 홈",
}: {
  title: string;
  crumbs: Crumb[];
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden px-5 py-6 md:px-8" style={{ background: heroGradient }}>
      {/* 물결 오버레이 */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full text-white/10"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path fill="currentColor" d="M0,64 C240,110 480,20 720,48 C960,76 1200,120 1440,72 L1440,120 L0,120 Z" />
      </svg>

      <div className="relative">
        {backHref ? (
          <Link href={backHref} className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-white/80 hover:text-white">
            <ArrowLeft size={13} /> {backLabel}
          </Link>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-tight text-white md:text-[31px]">{title}</h1>
        <nav className="mt-2 flex flex-wrap items-center gap-1.5 text-[13.5px] text-white/85">
          <Home size={14} />
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 || true ? <ChevronRight size={13} className="text-white/60" /> : null}
              {c.href ? (
                <Link href={c.href} className="hover:text-white hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
