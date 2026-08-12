"use client";

import { useEffect, useRef, useState } from "react";

type School = { name: string; sub: string };

/**
 * 학교명 검색 콤보박스.
 * 국내 중·고등학교(NEIS 오픈API) + 재외한국학교(저장 목록)를 검색해서 선택/입력한다.
 * <input name="schoolName"> 을 직접 렌더하므로 폼 제출값에 그대로 포함된다.
 */
export default function SchoolCombobox({
  name = "schoolName",
  defaultValue = "",
  placeholder = "학교명을 검색하세요 (예: 서울고, 동경한국학교)",
  required,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<School[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const id = ++reqSeq.current;
      try {
        const res = await fetch(`/api/schools?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { schools?: School[] };
        if (id === reqSeq.current) {
          setResults(data.schools ?? []);
          setActive(-1);
        }
      } catch {
        if (id === reqSeq.current) setResults([]);
      } finally {
        if (id === reqSeq.current) setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(s: School) {
    setQuery(s.name);
    setResults([]);
    setOpen(false);
  }

  const q = query.trim();
  const showPanel = open && q.length >= 1;

  return (
    <div ref={boxRef} className="relative">
      <input
        name={name}
        value={query}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showPanel) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && active >= 0 && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-md border border-slate-200 bg-[color:var(--surface-elevated)] px-3 py-2"
      />
      {showPanel ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">검색 중…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">일치하는 학교가 없습니다 · 입력한 이름으로 진행됩니다</li>
          ) : (
            results.map((s, i) => (
              <li key={`${s.name}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${i === active ? "bg-slate-50" : ""}`}
                >
                  <span className="truncate text-slate-900">{s.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{s.sub}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
