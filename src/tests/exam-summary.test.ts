import { describe, expect, it } from "vitest";
import { examSectionTable, formatExamSection, type ExamRow } from "@/lib/mentoring/exam-summary";

const Q = [1, 2, 3, 4, 5].map((n) => ({ number: n, type: "mcq", points: 20, answerKey: "3" }));
const base = { subject: "수학", opensAt: null, closesAt: null, examStatus: "published", questions: Q } as const;
const submitted: ExamRow = {
  ...base,
  title: "1차 모의고사",
  attempt: { status: "submitted", startedAt: new Date("2026-10-01T01:00:00Z"), deadlineAt: new Date("2026-10-01T02:00:00Z"), submittedAt: new Date("2026-10-01T01:40:00Z") },
  answers: [1, 2, 3, 4, 5].map((n) => ({ questionNo: n, choice: n === 2 || n === 5 ? 1 : 3, textAnswer: null })),
};

describe("활동 정리 — 시험 결과 섹션", () => {
  it("배정된 시험이 없으면 빈 문자열·표 없음", () => {
    expect(formatExamSection([])).toBe("");
    expect(examSectionTable([])).toBeNull();
  });
  it("제출한 시험은 항목별 줄로 점수·정답 수·오답 번호를 쓰고 정답 자체는 쓰지 않는다", () => {
    const t = formatExamSection([submitted]);
    expect(t).toContain("요약: 배정 1회 · 응시(제출) 1회 · 평균 60점");
    expect(t).toContain("■ 1차 모의고사 (수학)");
    expect(t).toContain("- 상태: 제출 (");
    expect(t).toContain("- 점수: 60 / 100점 · 정답 3/5문항");
    expect(t).toContain("- 오답 문항: 2, 5");
    expect(t).not.toMatch(/answerKey|정답:\s*3/);
  });
  it("표는 머리글 6열 + 시험당 1행", () => {
    const tb = examSectionTable([submitted])!;
    expect(tb.columns).toEqual(["시험", "응시 기간", "상태", "점수", "정답", "오답 문항"]);
    expect(tb.rows).toHaveLength(1);
    expect(tb.rows[0][0]).toBe("1차 모의고사 (수학)");
    expect(tb.rows[0][3]).toBe("60 / 100점");
    expect(tb.rows[0][5]).toBe("2, 5");
    expect(tb.caption).toContain("평균 60점");
  });
  it("마감 지난 미응시는 0점, 마감 전 미응시는 응시 가능으로 표기", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    const closedRow: ExamRow = { ...base, title: "2차", closesAt: new Date("2026-10-05T00:00:00Z"), attempt: null, answers: [] };
    const openRow: ExamRow = { ...base, title: "3차", closesAt: new Date("2026-10-20T00:00:00Z"), attempt: null, answers: [] };
    const t = formatExamSection([closedRow, openRow], now);
    expect(t).toContain("■ 2차 (수학)");
    expect(t).toContain("- 상태: 미응시 (마감)");
    expect(t).toContain("- 점수: 0 / 100점");
    expect(t).toContain("■ 3차 (수학)");
    expect(t).toContain("- 상태: 미응시 (응시 가능)");
    expect(t).toContain("응시(제출) 0회");
    const tb = examSectionTable([closedRow, openRow], now)!;
    expect(tb.rows[0][2]).toBe("미응시 (마감)");
    expect(tb.rows[1][3]).toBe("-");
  });
  it("응시 중인 시험은 작성한 답안 수를 보여준다", () => {
    const row: ExamRow = {
      ...base,
      title: "기말",
      attempt: { status: "in_progress", startedAt: new Date(), deadlineAt: new Date(Date.now() + 3600e3), submittedAt: null },
      answers: [{ questionNo: 1, choice: 3, textAnswer: null }, { questionNo: 2, choice: null, textAnswer: "  " }],
    };
    const t = formatExamSection([row]);
    expect(t).toContain("- 상태: 응시 중 (미제출)");
    expect(t).toContain("- 진행: 답안 작성 1/5문항");
  });
});
