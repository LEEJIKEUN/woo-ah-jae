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
- 각 요소마다 (1) 핵심 요약(summary)과 (2) 교사 관점의 평가·피드백(feedback: 잘한 점+보완점)을 쓴다. 각 2~3문장으로 간결히.
- 학생·관리자가 함께 읽는 보고서이므로 자연스러운 서술체("~했다", "~한 점이 돋보인다", "~을 보완하면 좋겠다"). 생기부 개조식(~함)은 쓰지 않는다.
- 자료에 실제로 있는 내용만 근거로 삼는다. 없는 사실·성과를 지어내지 않는다. 근거 없는 칭찬 금지.
- 보고서(탐구 보고서) 요소는 summary 에 핵심 흐름(주제→방법→결과→발견)을 담는다.
- overall 에는 종합 총평 3~4문장(강점 축 + 성장 방향).`;

function extractJson(text: string): unknown {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

/** Anthropic Messages API 를 스트리밍으로 호출해 text_delta 를 누적한다(대형 출력의 프록시 절단·지연 방지). */
async function streamClaudeText(apiKey: string, body: unknown, signal: AbortSignal): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `평가 보고서 생성 실패(${res.status}). ${t.slice(0, 160)}` };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let acc = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") acc += evt.delta.text ?? "";
        else if (evt.type === "error") return { ok: false, error: `평가 보고서 생성 실패. ${evt.error?.message ?? "stream error"}`.slice(0, 200) };
      } catch {
        /* 부분 수신 라인은 무시 */
      }
    }
  }
  return { ok: true, text: acc };
}

export async function generateEvalFeedback(dossierText: string, sectionTitles: string[]): Promise<GenReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 키(ANTHROPIC_API_KEY)가 설정되지 않았습니다." };
  // 평가 보고서는 서술체 요약/피드백이라 Haiku 4.5 로 충분(2~3배 빠름·저렴) → 타임아웃 완화. 필요 시 REPORT_AI_MODEL 로 상향.
  const model = process.env.REPORT_AI_MODEL || "claude-haiku-4-5";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  try {
    const instruction = `아래 학생 활동 자료를 읽고, 다음 섹션들에 대해 JSON으로만 답하라(설명·코드펜스 금지).
형식: {"overall":"종합 총평","sections":[{"title":"섹션 제목","summary":"핵심요약","feedback":"교사 평가/피드백"}]}
- title 은 반드시 아래 목록의 제목을 그대로 사용한다.
- 본문이 "(없음)"인 섹션은 결과에서 제외한다.
섹션 목록: ${sectionTitles.map((t) => `「${t}」`).join(", ")}

[학생 활동 자료]
${dossierText}`;

    // 스트리밍으로 받아 대형 출력의 프록시 절단/지연을 피한다.
    const streamed = await streamClaudeText(apiKey, { model, max_tokens: 4096, stream: true, system: SYSTEM, messages: [{ role: "user", content: instruction }] }, controller.signal);
    if (!streamed.ok) return streamed;
    const parsed = extractJson(streamed.text) as { overall?: unknown; sections?: unknown } | null;
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
