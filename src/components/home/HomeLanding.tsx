import HomeWorkshopFinder from "@/components/home/HomeWorkshopFinder";

/* 흰 바탕 · 글자 위주 · 실선 없음. 우·아·재 삼행시 + 설명 + 강좌 찾기. */
const BROWN = "#8C6E59";
const BODY = "#223039";
const SUB = "#8A8479";
const serif = { fontFamily: "var(--font-serif)" } as const;

const ACROSTIC: [string, string][] = [
  ["우", "리 아이의 가능성을 발견하고"],
  ["아", "이의 학습을 꾸준히 관리하며"],
  ["재", "능을 실력으로 만든다."],
];

export default function HomeLanding() {
  return (
    <div style={{ background: "#fff", color: BODY }}>
      {/* ── 삼행시 + 설명 ── */}
      <section className="mx-auto flex min-h-[40vh] max-w-[1000px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="inline-block text-left" style={serif}>
          {ACROSTIC.map(([head, rest]) => (
            <p key={head} className="leading-[1.85]" style={{ fontSize: "clamp(24px, 3.6vw, 34px)" }}>
              <span className="font-semibold" style={{ color: BROWN }}>{head}</span>
              <span style={{ color: BODY }}>{rest}</span>
            </p>
          ))}
        </div>
        <p className="mx-auto max-w-[660px] leading-9" style={{ color: SUB, marginTop: 44, fontSize: 16 }}>
          齋는 선비가 머물며 공부하던 서재를 뜻합니다.
          <br />
          우아재는 그 서재를 온라인에 옮겨, 배움이 오래 머무는 자리를 짓습니다.
        </p>
      </section>

      {/* ── 강좌 찾기 + 리스트 ── */}
      <HomeWorkshopFinder />
    </div>
  );
}
