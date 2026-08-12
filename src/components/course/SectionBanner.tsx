import { bannerGradient, IB } from "@/lib/course/theme";

/** 섹션 배너 — 하늘색 그라디언트 밴드(레퍼런스 Welcome / Learning engagements). */
export default function SectionBanner({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <div
        className="rounded-t-md px-4 py-2.5 text-[19px] font-semibold text-white"
        style={{ background: bannerGradient }}
      >
        {title}
      </div>
      {note ? (
        <p
          className="rounded-b-md border border-t-0 px-4 py-3 text-[14px] leading-6"
          style={{ borderColor: IB.border, background: "#F6F8FA", color: IB.body }}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
