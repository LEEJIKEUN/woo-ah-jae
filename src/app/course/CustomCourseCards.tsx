"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Folder } from "lucide-react";
import { getStoredCourses, type StoredCourse } from "@/lib/course/store";

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const serif = { fontFamily: "var(--font-serif)" } as const;

/** 관리자가 개설한 강좌 카드 (localStorage). */
export default function CustomCourseCards() {
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  useEffect(() => {
    setCourses(getStoredCourses());
  }, []);

  if (courses.length === 0) return null;

  return (
    <>
      {courses.map((c) => (
        <div key={c.id} className="flex w-full max-w-[280px] flex-col overflow-hidden rounded-[6px] border" style={{ borderColor: "#EAE2D2" }}>
          <div className="relative aspect-video" style={{ background: "linear-gradient(135deg, #8C6E59, #5f4a3a)" }}>
            <span className="absolute left-0 top-4 rounded-r-full bg-white py-1 pl-3 pr-4 text-[12px] font-bold" style={{ color: BROWN }}>
              {c.programme}
            </span>
            <span className="absolute bottom-3 left-4 text-[22px] font-extrabold tracking-tight text-white/95" style={serif}>우아재</span>
          </div>
          <div className="flex flex-1 flex-col p-3.5">
            <Link href={`/course/${c.id}`} className="line-clamp-2 text-[16px] font-semibold leading-6 hover:underline" style={{ color: INK }}>
              {c.title}
            </Link>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px]" style={{ color: SUB }}>
              <Folder size={14} /> {c.audience} · {c.deliveryMode}
            </p>
            <Link href={`/course/${c.id}`} className="mt-3.5 w-full rounded-[6px] py-2 text-center text-[14px] font-bold text-white" style={{ background: BROWN }}>
              강좌 보기
            </Link>
          </div>
        </div>
      ))}
    </>
  );
}
