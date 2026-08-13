"use client";

import { useRef, useState } from "react";

export type Member = { id: string; name: string };

/** @이름 자동완성이 되는 입력 필드(인스타그램식). textarea/input 겸용. */
export default function MentionField({
  as = "textarea",
  value,
  onChange,
  members,
  placeholder,
  rows = 3,
  className,
  style,
  onEnter,
}: {
  as?: "textarea" | "input";
  value: string;
  onChange: (v: string) => void;
  members: Member[];
  placeholder?: string;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
  onEnter?: () => void;
}) {
  const elRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState(0);
  const [hi, setHi] = useState(0);

  function refresh(v: string, caret: number) {
    const before = v.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]{0,20})$/.exec(before);
    if (m) {
      setQuery(m[1]);
      setAnchor(caret - m[1].length - 1);
      setHi(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  const matches = open ? members.filter((mm) => mm.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];

  function pick(name: string) {
    const el = elRef.current;
    const caret = el?.selectionStart ?? value.length;
    const next = value.slice(0, anchor) + `@${name} ` + value.slice(caret);
    onChange(next);
    setOpen(false);
    const newCaret = anchor + name.length + 2;
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      }
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    onChange(e.target.value);
    refresh(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (open && matches.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % matches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[hi]?.name ?? ""); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (onEnter && as === "input" && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnter();
    }
  }

  return (
    <div className="relative">
      {as === "textarea" ? (
        <textarea ref={(el) => { elRef.current = el; }} value={value} onChange={handleChange} onKeyDown={handleKeyDown} rows={rows} placeholder={placeholder} className={className} style={style} />
      ) : (
        <input ref={(el) => { elRef.current = el; }} value={value} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={placeholder} className={className} style={style} />
      )}
      {open && matches.length ? (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-56 w-56 overflow-auto rounded-[10px] border bg-white p-1 shadow-lg" style={{ borderColor: "#E4DBC7" }}>
          {matches.map((mm, i) => (
            <li key={mm.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(mm.name); }}
                className={`flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-[13px] ${i === hi ? "bg-[#FBF6EC]" : "hover:bg-[#FBF8F2]"}`}
              >
                <span className="font-semibold" style={{ color: "#8C6E59" }}>@{mm.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
