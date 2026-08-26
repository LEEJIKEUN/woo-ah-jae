/**
 * 최종 평가 보고서용 — dossier(요소별 원문)를 근거로 Claude 가 각 요소의 핵심요약 + 교사 평가/피드백을 생성.
 * 결과 JSON 을 eval-report-pdf 가 원문과 나란히 렌더한다.
 */
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type SectionFeedback = { title: string; summary: string; feedback: string };
export type EvalReport = { overall: string; sections: SectionFeedback[] };
export type GenReport = { ok: true; report: EvalReport; model: string } | { ok: false; error: string };

const SYSTEM = `너는 대한민국 고교 담당 교사다. 학생이 우아재에서 남긴 활동 자료를 요소(섹션)별로 평가·피드백한다.
규칙:
- 각 요소마다 (1) 핵심을 짚는 요약(summary)과 (2) 교사 관점의 평가·피드백(feedback: 잘한 점과 보완점)을 쓴다. 2~4문장.
- 문체는 학생·관리자가 함께 읽는 보고서이므로 자연스러운 서술체(예: "~했다", "~한 점이 돋보인다", "~을 보완하면 좋겠다"). 생기부 개조식(~함)은 쓰지 않는다.
- 자료에 실제로 있는 내용만 근거로 삼는다. 없는 사실·성과를 지어내지 않는다. 근거 없는 칭찬 금지.
- 보고서(탐구 보고서) 요소는 summary 에 핵심 흐름(주제→방법→결과→발견)을 꼭 담는다.
- overall 에는 학생의 활동을 종합한 3~5문장 총평(강점 축 + 성장 방향)을 쓴다.`;

function extractJson(text: string): unknown {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

export async function generateEvalFeedback(dossierText: string, sectionTitles: string[]): Promise<GenReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 키(ANTHROPIC_API_KEY)가 설정되지 않았습니다." };
  const model = process.env.SETE_AI_MODEL || process.env.EXAM_AI_MODEL || "claude-sonnet-4-6";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);
  try {
    const instruction = `아래 학생 활동 자료를 읽고, 다음 섹션들에 대해 JSON으로만 답하라(설명·코드펜스 금지).
형식: {"overall":"종합 총평","sections":[{"title":"섹션 제목","summary":"핵심요약","feedback":"교사 평가/피드백"}]}
- title 은 반드시 아래 목록의 제목을 그대로 사용한다.
- 본문이 "(없음)"인 섹션은 결과에서 제외한다.
섹션 목록: ${sectionTitles.map((t) => `「${t}」`).join(", ")}

[학생 활동 자료]
${dossierText}`;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, max_tokens: 4096, system: SYSTEM, messages: [{ role: "user", content: instruction }] }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `평가 보고서 생성 실패(${res.status}). ${t.slice(0, 160)}` };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    const parsed = extractJson(text) as { overall?: unknown; sections?: unknown } | null;
    if (!parsed) return { ok: false, error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요." };

    const rawSections = Array.isArray(parsed.sections) ? (parsed.sections as Record<string, unknown>[]) : [];
    const sections: SectionFeedback[] = rawSections.map((s) => ({
      title: String(s.title ?? "").slice(0, 120),
      summary: String(s.summary ?? "").slice(0, 2000),
      feedback: String(s.feedback ?? "").slice(0, 3000),
    })).filter((s) => s.title && (s.summary || s.feedback));

    return { ok: true, report: { overall: String(parsed.overall ?? "").slice(0, 3000), sections }, model };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "평가 보고서 생성 시간이 초과되었습니다." : "평가 보고서 생성 중 오류가 발생했습니다.";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
