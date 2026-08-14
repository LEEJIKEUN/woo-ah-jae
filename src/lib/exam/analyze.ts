/**
 * 시험지 PDF(문제 + 빠른정답 + 해설) → 문항 구성·정답 자동 추출.
 * 런타임에 Anthropic API(Claude)가 PDF 를 직접 읽어 구조화한다(별도 npm 의존성 없이 fetch).
 * 정답(answerKey)은 서버에서만 다루고 학생에게는 절대 노출하지 않는다.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type AnalyzedQuestion = { number: number; type: "mcq" | "short"; choiceCount: number; answerKey: string };
export type AnalyzeResult = { ok: true; questions: AnalyzedQuestion[] } | { ok: false; error: string };

const PROMPT = [
  "너는 한국 모의고사 시험지 PDF 를 분석한다. 이 PDF 에는 문제(문항), 빠른정답(정답표), 해설이 함께 들어 있다.",
  "모든 문항을 빠짐없이 추출해라. 빠른정답표를 문항 개수와 정답의 최종 근거로 삼아라.",
  "각 문항에 대해 다음을 판정한다:",
  "- number: 문항 번호(1,2,3 …)",
  "- type: 'mcq'(객관식·선택형) 또는 'short'(주관식·단답형·서술형)",
  "- choiceCount: 객관식이면 보기(선지) 개수(대개 5, 때로 4). 주관식이면 0.",
  "- answerKey: 정답. 객관식이면 정답 보기 번호를 문자열로(예: '3'). 주관식이면 정답 텍스트.",
  "해설 내용은 넣지 마라. 오직 아래 형식의 JSON 만 출력해라(설명·코드펜스 금지):",
  '{"questions":[{"number":1,"type":"mcq","choiceCount":5,"answerKey":"3"}]}',
].join("\n");

function extractJson(text: string): { questions?: unknown } | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as { questions?: unknown }) : null;
  } catch {
    return null;
  }
}

export async function analyzeExamPdf(pdfBase64: string): Promise<AnalyzeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 키(ANTHROPIC_API_KEY)가 설정되지 않았습니다. 관리자에게 문의하세요." };
  const model = process.env.EXAM_AI_MODEL || "claude-sonnet-4-6";

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `AI 분석 실패(${res.status}). ${t.slice(0, 160)}` };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.questions)) return { ok: false, error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요." };

    const raw = parsed.questions as Record<string, unknown>[];
    const questions: AnalyzedQuestion[] = raw
      .map((q, i) => {
        const type = q.type === "short" ? "short" : "mcq";
        const ccNum = typeof q.choiceCount === "number" ? Math.trunc(q.choiceCount) : Number(q.choiceCount);
        return {
          number: typeof q.number === "number" ? q.number : i + 1,
          type: type as "mcq" | "short",
          choiceCount: type === "mcq" ? (Number.isFinite(ccNum) && ccNum >= 2 && ccNum <= 10 ? ccNum : 5) : 0,
          answerKey: typeof q.answerKey === "string" ? q.answerKey.slice(0, 200).trim() : String(q.answerKey ?? "").slice(0, 200),
        };
      })
      .sort((a, b) => a.number - b.number);

    if (!questions.length) return { ok: false, error: "문항을 찾지 못했습니다. PDF 를 확인해 주세요." };
    return { ok: true, questions };
  } catch {
    return { ok: false, error: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
