"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";

const BROWN = "#8C6E59";
const NUM = "#B58F72";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;
const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;

/**
 * 관리자용 새 강좌 개설 안내.
 * 새 강좌는 기존 강좌를 '복제'해 만든다(메뉴·기능 완전 동일, 기록물 없음, 비공개 생성).
 * 복제는 VS Code 에서 `npm run course:clone` 으로 실행하므로, 이 화면은 명령과 절차를 안내한다.
 */
export default function CloneGuide() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);

  const safeId = id.trim() || "<새-강좌-id>";
  const safeTitle = (title.trim() || "새 강좌 제목").replace(/"/g, "");
  const command = `npm run course:clone -- --id ${safeId} --title "${safeTitle}"`;

  function copy() {
    navigator.clipboard?.writeText(command).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); }
    );
  }

  return (
    <div style={{ background: "#fff", color: INK }}>
      <div className="mx-auto max-w-[760px] px-6 pt-20 pb-32">
        <p className="text-center text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.24em", color: NUM }}>NEW COURSE</p>
        <h1 className="mt-4 text-center text-[30px] font-normal md:text-[38px]" style={{ ...serif, color: INK, letterSpacing: "-0.03em" }}>새 강좌 개설</h1>
        <p className="mt-4 text-center text-[14.5px] leading-7" style={{ color: SUB }}>
          새 강좌는 <b style={{ color: BROWN }}>기존 강좌를 복제</b>해 만듭니다. 모든 메뉴·기능(게시판·멘토링·시험·현황·출석·강의)이
          <br className="hidden md:block" /> 그대로 복제되고, 수강생·게시글·댓글·시험 등 <b style={{ color: BROWN }}>기록물은 처음부터 비어</b> 있으며 <b style={{ color: BROWN }}>비공개</b>로 생성됩니다.
        </p>

        {/* 명령 만들기 */}
        <div className="mt-12 rounded-[16px] border p-6 md:p-8" style={{ borderColor: LINE, background: PANEL }}>
          <h2 className="text-[17px]" style={{ ...serif, color: INK }}>1. 복제 명령 만들기</h2>
          <p className="mt-1.5 text-[13px] leading-6" style={{ color: SUB }}>아래 두 값을 채우면 명령이 완성됩니다. 복사해 VS Code 터미널에서 실행하세요.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[13px]" style={{ color: INK }}>강좌 id <span style={{ color: SUB }}>(영문 소문자·숫자·하이픈)</span></span>
              <input value={id} onChange={(e) => setId(e.target.value)} placeholder="예: physics-101"
                className="mt-2 w-full rounded-[10px] border bg-white px-3 text-[14px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK, height: 44, ...mono }} />
            </label>
            <label className="block">
              <span className="text-[13px]" style={{ color: INK }}>강좌 제목</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 고교 물리 입문"
                className="mt-2 w-full rounded-[10px] border bg-white px-3 text-[14px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK, height: 44 }} />
            </label>
          </div>

          <div className="mt-5 flex items-stretch gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-[10px] border px-4 py-3 text-[13px]" style={{ borderColor: LINE, background: "#fff", color: INK, ...mono }}>{command}</code>
            <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-[13px] font-semibold text-white" style={{ background: BROWN }}>
              {copied ? <><Check size={15} /> 복사됨</> : <><Copy size={15} /> 복사</>}
            </button>
          </div>
          <p className="mt-3 text-[12.5px] leading-6" style={{ color: SUB }}>
            다른 강좌를 원본으로 쓰려면 <code style={{ ...mono, color: BROWN }}>--from &lt;원본-id&gt;</code> 를 덧붙이세요. 생략하면 시드 강좌(인공지능을 위한 선형대수학)를 복제합니다.
          </p>
        </div>

        {/* 이후 절차 */}
        <div className="mt-6 rounded-[16px] border p-6 md:p-8" style={{ borderColor: LINE }}>
          <h2 className="text-[17px]" style={{ ...serif, color: INK }}>2. 이후 절차</h2>
          <ol className="mt-4 space-y-3">
            {[
              <>명령을 실행하면 <code style={{ ...mono, color: BROWN }}>src/lib/course/courses/&lt;id&gt;.ts</code> 파일이 생성·자동 등록됩니다.</>,
              <>VS Code 에서 그 파일을 열어 주차 날짜·세션 제목·본문·강의자료를 <b>새 강좌에 맞게 수정</b>합니다. (강의자료 경로는 아직 원본을 가리킵니다)</>,
              <><code style={{ ...mono, color: BROWN }}>npm run build</code> 로 확인 → 커밋 → <code style={{ ...mono, color: BROWN }}>npm run release:allow</code> → <code style={{ ...mono, color: BROWN }}>git push origin main</code> 으로 배포합니다.</>,
              <>관리자로 접속해 강좌 상태를 <b>‘접수중’</b> 등으로 바꾸면 공개됩니다. (그 전까지는 관리자에게만 보입니다)</>,
            ].map((node, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: NUM }}>{i + 1}</span>
                <span className="text-[13.5px] leading-7" style={{ color: INK }}>{node}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-6 text-center text-[12.5px] leading-6" style={{ color: SUB }}>
          코드로 만드는 이유 — 모든 강좌를 하드코딩 기준으로 운영하면 메뉴·기능이 항상 동일하게 보장되고,
          <br className="hidden md:block" /> VS Code 에서 강좌 화면을 자유롭게 세밀 편집할 수 있습니다. 라이브 데이터에는 전혀 영향이 없습니다.
        </p>

        <div className="mt-8 flex justify-center">
          <button type="button" onClick={() => router.push("/")} className="rounded-[8px] border px-8 py-3 text-[15px]" style={{ borderColor: LINE, color: SUB, ...serif }}>홈으로</button>
        </div>
      </div>
    </div>
  );
}
