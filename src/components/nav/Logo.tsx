/** 우아재 엠블럼 — 육각 문양 + 齋(정중앙, flex 중앙정렬). */
export default function Logo({
  size = 34,
  color = "#8c6e59",
  withText = true,
}: {
  size?: number;
  color?: string;
  withText?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative inline-block" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 40 40" className="absolute inset-0" aria-hidden>
          <path
            d="M38,20 L29,35.6 L11,35.6 L2,20 L11,4.4 L29,4.4 Z"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontFamily: "var(--font-serif)", fontSize: size * 0.46, lineHeight: 1, color }}
          aria-hidden
        >
          齋
        </span>
      </span>
      {withText ? (
        <span className="text-[20px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-serif)", color }}>
          우아재
        </span>
      ) : null}
    </span>
  );
}
