/**
 * 시험지 PDF(문제 + 빠른정답 + 해설) → 문항 구성·정답 자동 추출.
 * 런타임에 Anthropic API(Claude)가 PDF 를 직접 읽어 구조화한다(별도 npm 의존성 없이 fetch).
 * 정답(answerKey)은 서버에서만 다루고 학생에게는 절대 노출하지 않는다.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type AnalyzedQuestion = { number: number; type: "mcq" | "short"; choiceCount: number; answerKey: string };
export type AnalyzeResult = { ok: true; questions: AnalyzedQuestion[]; answerStartPage: number | null } | { ok: false; error: string };

const PROMPT = [
  "너는 한국 수학 모의고사 시험지 PDF 를 분석한다. PDF 안에는 문제, '빠른정답'(정답표), 해설이 함께 있다.",
  "'빠른정답' 표를 정답과 문항 수의 최종 근거로 삼아, 표에 있는 모든 문항을 순서대로 추출해라.",
  "",
  "문항 유형 판정(빠른정답 표 기준):",
  "- 정답이 동그라미 숫자(①②③④⑤ 등)이면 → type='mcq'(객관식 5지선다), choiceCount=5, answerKey 는 그 숫자만(예: ②→'2', ④→'4').",
  "- 정답이 수·분수·식·단위 포함 값이면(예: 7, 15/8, 14 m, 1100, 53/165, 5/2) → type='short'(단답형), choiceCount=0, answerKey 는 그 값을 문자열로(분수는 '15/8' 형태, 있는 그대로).",
  "",
  "규칙: 표에 없는 문항을 지어내지 마라. 문항 번호는 표의 번호를 그대로 쓴다. 해설 내용은 넣지 마라.",
  "또한 'answerStartPage': 빠른정답(또는 해설) 섹션이 처음 시작하는 PDF 페이지 번호(1부터). 문제만 있고 정답/해설이 없으면 null.",
  "오직 아래 형식의 JSON 만 출력해라(설명·코드펜스 금지):",
  '{"answerStartPage":8,"questions":[{"number":1,"type":"short","choiceCount":0,"answerKey":"7"},{"number":2,"type":"mcq","choiceCount":5,"answerKey":"2"}]}',
].join("\n");

const CIRCLED: Record<string, string> = { "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5", "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10" };
function normalizeAnswer(s: string): string {
  return s.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (c) => CIRCLED[c] ?? c).trim();
}

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
    const parsed = extractJson(text) as { questions?: unknown; answerStartPage?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.questions)) return { ok: false, error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요." };
    const asp = typeof parsed.answerStartPage === "number" && parsed.answerStartPage > 1 ? Math.trunc(parsed.answerStartPage) : null;

    const raw = parsed.questions as Record<string, unknown>[];
    const questions: AnalyzedQuestion[] = raw
      .map((q, i) => {
        const type = q.type === "short" ? "short" : "mcq";
        const ccNum = typeof q.choiceCount === "number" ? Math.trunc(q.choiceCount) : Number(q.choiceCount);
        return {
          number: typeof q.number === "number" ? q.number : i + 1,
          type: type as "mcq" | "short",
          choiceCount: type === "mcq" ? (Number.isFinite(ccNum) && ccNum >= 2 && ccNum <= 10 ? ccNum : 5) : 0,
          answerKey: normalizeAnswer((typeof q.answerKey === "string" ? q.answerKey : String(q.answerKey ?? "")).slice(0, 200)),
        };
      })
      .sort((a, b) => a.number - b.number);

    if (!questions.length) return { ok: false, error: "문항을 찾지 못했습니다. PDF 를 확인해 주세요." };
    return { ok: true, questions, answerStartPage: asp };
  } catch {
    return { ok: false, error: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
