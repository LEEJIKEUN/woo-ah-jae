/**
 * 세특 바이트 계산(서버용). NEIS 기준과 동일한 UTF-8 바이트 수(한글=3바이트).
 * 클라이언트(MentoringView.tsx)의 byteLen/truncateToBytes 와 동일 규칙 — 카운트가 항상 일치하도록.
 */
export function byteLen(s: string): number {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length;
  }
}

/** UTF-8 바이트 기준으로 잘라내기(초과분 제거, 문자 경계 보존). */
export function truncateToBytes(s: string, maxBytes: number): string {
  const enc = new TextEncoder();
  if (enc.encode(s).length <= maxBytes) return s;
  let out = "";
  let bytes = 0;
  for (const ch of s) {
    const b = enc.encode(ch).length;
    if (bytes + b > maxBytes) break;
    out += ch;
    bytes += b;
  }
  return out;
}

/** 문장 경계(…함. / …음.)까지 되감아 자르기 — 세특 하드 트림 시 문장 중간에서 끊기지 않게. */
export function truncateToSentenceBytes(s: string, maxBytes: number): string {
  const cut = truncateToBytes(s, maxBytes);
  if (cut.length === s.length) return cut;
  // 마지막 종결어미(함./음./임./slash 마침표) 위치까지 되감기
  const m = cut.match(/^[\s\S]*(?:함|음|임|됨|옴|짐)\.\s*/);
  if (m && m[0].trim().length >= Math.floor(cut.length * 0.6)) return m[0].trim();
  const lastPeriod = cut.lastIndexOf(".");
  if (lastPeriod >= Math.floor(cut.length * 0.6)) return cut.slice(0, lastPeriod + 1);
  return cut.trim();
}
