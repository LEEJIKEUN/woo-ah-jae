"use client";

import { useEffect, useRef } from "react";

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤩", "🥳", "😉", "🙂", "😇", "🤔", "😅", "😳",
  "😢", "😭", "😤", "😱", "🥺", "😬", "😴", "🤗",
  "👍", "👎", "👏", "🙏", "💪", "🙌", "👌", "✌️",
  "🤝", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤",
  "🔥", "✨", "⭐", "🎉", "🎈", "🎁", "💯", "✅",
  "❌", "❓", "❗", "📌", "📎", "📚", "✏️", "💡",
];

/** 외부 API 없이 동작하는 가벼운 이모지 선택기(무료·오프라인). */
export default function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-full left-0 z-40 mb-1 grid grid-cols-8 gap-1 rounded-[10px] border bg-white p-2 shadow-lg" style={{ borderColor: "#E4DBC7", width: 272 }}>
      {EMOJIS.map((e) => (
        <button key={e} type="button" onMouseDown={(ev) => { ev.preventDefault(); onPick(e); }} className="grid h-7 w-7 place-items-center rounded text-[18px] hover:bg-[#FBF6EC]">
          {e}
        </button>
      ))}
    </div>
  );
}
