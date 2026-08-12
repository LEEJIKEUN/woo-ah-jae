"use client";

import { Lock } from "lucide-react";
import type { Module } from "@/lib/course/content";
import { cn } from "@/lib/course/cn";
import { IB } from "@/lib/course/theme";

/** 모듈 가로 탭 (레퍼런스 onetopic 포맷). active=흰 배경+보더, locked=회색 이탤릭 disabled. */
export default function ModuleTabs({
  modules,
  activeId,
  onSelect,
}: {
  modules: Module[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-1 border-b" style={{ borderColor: IB.border }}>
      {modules.map((m) => {
        const active = m.id === activeId;
        if (m.locked) {
          return (
            <span
              key={m.id}
              className="flex cursor-not-allowed items-center gap-1.5 px-3.5 py-2.5 text-[14px] italic"
              style={{ color: "#9AA0A6" }}
              title="아직 잠긴 모듈입니다"
            >
              <Lock size={12} /> {m.label}
            </span>
          );
        }
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={cn(
              "-mb-px rounded-t-md px-3.5 py-2.5 text-[14px] transition",
              active ? "border border-b-white bg-white font-semibold" : "font-normal hover:bg-white/60"
            )}
            style={{
              borderColor: active ? IB.border : "transparent",
              color: active ? "#343A40" : IB.navy,
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
