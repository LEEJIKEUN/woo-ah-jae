import { SETE_SYSTEM_PROMPT } from "@/lib/mentoring/sete-prompt";
import { byteLen, truncateToSentenceBytes } from "@/lib/mentoring/bytes";

/**
 * ② 세특 생성 — 우아재 안에서 만든 '활동 정리 PDF'(+학생 보고서 PDF)를 Claude API 가 직접 읽어
 * 2000바이트 미만 세특(생기부 양식)을 작성한다. exam/analyze.ts 의 document 첨부 패턴 재사용.
 */
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const BYTE_LIMIT = 2000;

export type GenSete = { ok: true; text: string; byteCount: number; model: string } | { ok: false; error: string };

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

function doc(base64: string): ContentBlock {
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
}

function extractText(data: unknown): string {
  const blocks = (data as { content?: { type: string; text?: string }[] })?.content ?? [];
  return blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
}

function cleanOutput(s: string): string {
  let t = s.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  if ((t.startsWith("\"") && t.endsWith("\"")) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1).trim();
  return t;
}

async function callClaude(model: string, apiKey: string, messages: { role: "user" | "assistant"; content: ContentBlock[] | string }[], signal: AbortSignal): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal,
    body: JSON.stringify({ model, max_tokens: 1500, system: SETE_SYSTEM_PROMPT, messages }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI 생성 실패(${res.status}). ${t.slice(0, 160)}`);
  }
  return cleanOutput(extractText(await res.json()));
}

export async function generateSete(opts: { dossierPdfBase64: string; reportPdfBase64?: string }): Promise<GenSete> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 키(ANTHROPIC_API_KEY)가 설정되지 않았습니다. 관리자에게 문의하세요." };
  const model = process.env.SETE_AI_MODEL || process.env.EXAM_AI_MODEL || "claude-sonnet-4-6";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const userContent: ContentBlock[] = [doc(opts.dossierPdfBase64)];
    if (opts.reportPdfBase64) userContent.push(doc(opts.reportPdfBase64));
    userContent.push({ type: "text", text: "첨부한 '활동 정리 PDF'(및 학생 보고서 PDF)를 근거로 이 학생의 과목 세특을 2000바이트(NEIS 한글 3바이트) 이하로 작성하라. 본문만 출력." });

    let text = await callClaude(model, apiKey, [{ role: "user", content: userContent }], controller.signal);
    if (!text) return { ok: false, error: "AI 응답이 비어 있습니다. 다시 시도해 주세요." };

    if (byteLen(text) > BYTE_LIMIT) {
      const retry = await callClaude(model, apiKey, [
        { role: "user", content: userContent },
        { role: "assistant", content: text },
        { role: "user", content: `직전 출력이 ${byteLen(text)}바이트로 2000바이트를 초과함. 핵심 활동·인지적 전환점·교사 평가 마무리는 유지하되 2000바이트 이하로 다시 작성하라. 본문만 출력.` },
      ], controller.signal);
      if (retry) text = retry;
    }
    if (byteLen(text) > BYTE_LIMIT) text = truncateToSentenceBytes(text, BYTE_LIMIT);

    return { ok: true, text, byteCount: byteLen(text), model };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "AI 생성 시간이 초과되었습니다. 다시 시도해 주세요." : "AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
