import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import SeteCell, { seteHeadline } from "@/app/course/[courseId]/status/SeteCell";

const HEAD = "<기상 데이터를 행렬로 설계하고 정규방정식으로 대기질 예측 모델을 완성한 학생>";
const LONG = `${HEAD}\n\n싱가포르의 헤이즈 악화 뉴스를 접한 것을 계기로 탐구를 설계함. 공개 API로 100일치 데이터를 수집함.`;

describe("세특 현황 셀 — 첫 문장 + 더보기", () => {
  it("<…학생> 머리말이 있으면 그것만 첫 문장으로 쓴다", () => {
    expect(seteHeadline(LONG)).toBe(HEAD);
  });
  it("머리말이 없으면 첫 줄의 첫 문장을 쓴다", () => {
    expect(seteHeadline("헤이즈 뉴스를 계기로 탐구를 설계함. 공개 API로 데이터를 수집함.\n둘째 줄")).toBe("헤이즈 뉴스를 계기로 탐구를 설계함.");
  });
  it("긴 첫 문장은 90자에서 말줄임한다", () => {
    const s = "가".repeat(120) + ".";
    const h = seteHeadline(s);
    expect(h.endsWith("…")).toBe(true);
    expect(h.length).toBe(91);
  });
  it("접힌 상태는 머리말과 더보기 버튼만 보이고 본문은 숨긴다", () => {
    const html = renderToString(createElement(SeteCell, { text: LONG }));
    expect(html).toContain("기상 데이터를 행렬로 설계하고");
    expect(html).toContain("더보기");
    expect(html).not.toContain("싱가포르의 헤이즈");
  });
  it("한 문장뿐이면 버튼 없이 전체를 보여준다", () => {
    const html = renderToString(createElement(SeteCell, { text: "짧은 세특임." }));
    expect(html).toContain("짧은 세특임.");
    expect(html).not.toContain("더보기");
  });
});
