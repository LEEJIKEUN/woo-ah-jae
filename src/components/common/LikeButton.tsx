"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  initialCount: number;
  className?: string;
  onLike?: (projectId: string, liked: boolean) => void;
};

export default function LikeButton({ projectId, initialCount, className, onLike }: Props) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  function toggleLike() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((prev) => (nextLiked ? prev + 1 : Math.max(prev - 1, 0)));
    onLike?.(projectId, nextLiked);
  }

  return (
    <button
      type="button"
      aria-label="좋아요"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLike();
      }}
      className={className ?? "inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
