import { Fragment, type ReactNode, type CSSProperties } from "react";

/**
 * 사용자 입력 텍스트 출력 공용 렌더러.
 * - 줄바꿈 보존(whitespace-pre-line) + 긴 문자열/URL 자동 줄바꿈(break-words) → 틀 안 깨짐
 * - http(s) URL 자동 링크화 → 새 탭에서 열림(rel=noopener)
 * 데이터는 그대로 두고 '표시'만 개선(저장값 변경 없음).
 */
export default function LinkifiedText({
  text,
  className,
  style,
  linkColor = "#2563eb",
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  linkColor?: string;
}) {
  const nodes: ReactNode[] = [];
  const re = /(https?:\/\/[^\s]+)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let url = m[0];
    let trail = "";
    const tm = /[.,;:!?)\]}'"]+$/.exec(url); // URL 뒤 문장부호는 링크에서 제외
    if (tm) { trail = tm[0]; url = url.slice(0, url.length - trail.length); }
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    nodes.push(
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="break-all underline" style={{ color: linkColor }}>
        {url}
      </a>
    );
    if (trail) nodes.push(<Fragment key={key++}>{trail}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);

  return (
    <span className={`whitespace-pre-line break-words ${className ?? ""}`} style={style}>
      {nodes}
    </span>
  );
}
