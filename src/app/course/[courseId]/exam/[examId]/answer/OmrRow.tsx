"use client";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#D8CDB6";

/**
 * OMR 한 행 — 문항번호 + 원형 보기.
 * - 단일 선택. 선택된 보기 다시 누르면 해제.
 * - role=radiogroup/radio, 좌우(상하) 방향키 이동 · 숫자키 1~N 즉시 선택.
 * - 터치 타깃 44×44 이상.
 */
export default function OmrRow({
  number,
  choiceCount,
  value,
  onChange,
  disabled = false,
}: {
  number: number;
  choiceCount: number;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const choices = Array.from({ length: choiceCount }, (_, i) => i + 1);

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key >= "1" && e.key <= String(choiceCount)) {
      onChange(Number(e.key));
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      onChange(value ? Math.min(choiceCount, value + 1) : 1);
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      onChange(value ? Math.max(1, value - 1) : 1);
      e.preventDefault();
    }
  }

  return (
    <div className="flex items-center gap-3 py-2" id={`q-${number}`}>
      <div className="flex w-10 shrink-0 items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: value == null ? "#D9B24A" : "transparent" }} aria-hidden />
        <span className="text-[15px] font-bold" style={{ color: INK }}>{number}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={`${number}번 답 선택`}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2 rounded-[10px] outline-none focus:ring-2"
        style={{ ["--tw-ring-color" as string]: "#C8B08F" }}
      >
        {choices.map((c) => {
          const on = value === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${c}번`}
              disabled={disabled}
              onClick={() => onChange(on ? null : c)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-[15px] font-bold transition disabled:cursor-not-allowed"
              style={{
                borderColor: on ? BROWN : LINE,
                background: on ? BROWN : "#fff",
                color: on ? "#fff" : SUB,
              }}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
