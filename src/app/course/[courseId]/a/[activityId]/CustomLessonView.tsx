"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getStoredCourse, type StoredCourse, type StoredLesson } from "@/lib/course/store";

const BROWN = "#8C6E59";
const NUM = "#B58F72";
const INK = "#2C2823";
const BODY = "#223039";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

/** 관리자가 개설한(localStorage) 강좌의 학습 화면 — 홈 서재 톤. */
export default function CustomLessonView({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [course, setCourse] = useState<StoredCourse | null>(null);
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    setCourse(getStoredCourse(courseId));
    setReady(true);
    setSubmitted(false);
    setAnswer("");
  }, [courseId, lessonId]);

  if (!course) {
    return <div className="mx-auto max-w-[640px] px-6 py-40 text-center" style={{ color: SUB }}>{ready ? "강좌를 찾을 수 없습니다." : "불러오는 중…"}</div>;
  }

  let current: StoredLesson | null = null;
  let currentModule = "";
  for (const m of course.modules) {
    for (const l of m.lessons ?? []) {
      if (l.id === lessonId) {
        current = l;
        currentModule = m.label;
      }
    }
  }

  return (
    <div className="flex w-full flex-1" style={{ background: "#fff" }}>
      {/* 좌측 목차 */}
      <aside className="hidden w-[280px] shrink-0 border-r px-5 py-7 lg:block" style={{ borderColor: LINE }}>
        <Link href={`/course/${courseId}`} className="text-[18px]" style={{ ...serif, color: INK }}>{course.title}</Link>
        <p className="mt-1 text-[12px]" style={{ color: SUB }}>{course.programme}</p>
        <div className="mt-6 space-y-5">
          {course.modules.map((m, mi) => (
            <div key={mi}>
              <p className="text-[13px] font-semibold" style={{ ...serif, color: BROWN }}>{m.label}</p>
              <ul className="mt-2 space-y-1.5">
                {(m.lessons ?? []).map((l) => {
                  const on = l.id === lessonId;
                  return (
                    <li key={l.id}>
                      <Link href={`/course/${courseId}/a/${l.id}`} className="flex items-start gap-2 text-[13px] leading-5 hover:underline" style={{ color: on ? INK : SUB }}>
                        <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: BROWN, background: on ? BROWN : "transparent" }} />
                        <span className="min-w-0">{l.title}</span>
                      </Link>
                    </li>
                  );
                })}
                {(m.lessons ?? []).length === 0 ? <li className="text-[12px]" style={{ color: SUB }}>준비 중</li> : null}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      {/* 본문 */}
      <div className="min-w-0 flex-1 px-6 py-10 md:px-14">
        <div className="mx-auto max-w-[720px]">
          <Link href={`/course/${courseId}`} className="mb-3 inline-flex items-center gap-1 text-[13px]" style={{ ...serif, color: BROWN }}>
            <ChevronLeft size={14} /> 강좌 소개
          </Link>

          {current ? (
            <>
              <p className="text-[12px]" style={{ color: NUM }}>{currentModule} · {current.kind === "assignment" ? "과제" : "강의자료"}</p>
              <h1 className="mt-2 font-normal" style={{ ...serif, color: INK, fontSize: "clamp(24px, 3.4vw, 32px)", letterSpacing: "-0.02em" }}>{current.title}</h1>

              {current.body ? (
                <p className="mt-7 whitespace-pre-line text-[16px] leading-9" style={{ color: BODY }}>{current.body}</p>
              ) : (
                <p className="mt-7 text-[15px]" style={{ color: SUB }}>내용이 아직 입력되지 않았습니다.</p>
              )}

              {current.kind === "assignment" ? (
                <div className="mt-10 rounded-[12px] p-6" style={{ background: PANEL }}>
                  <h3 className="text-[16px]" style={{ ...serif, color: INK }}>과제 제출</h3>
                  {submitted ? (
                    <p className="mt-3 text-[14px] leading-7" style={{ color: BROWN }}>제출이 완료되었습니다. 담당자 확인 후 피드백이 등록됩니다.</p>
                  ) : (
                    <>
                      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder="답안을 작성하세요."
                        className="mt-3 w-full rounded-[10px] border bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#8C6E59]" style={{ borderColor: LINE, color: INK }} />
                      <div className="mt-3">
                        <button type="button" onClick={() => { if (!answer.trim()) { alert("답안을 입력하세요."); return; } setSubmitted(true); }}
                          className="rounded-[8px] px-6 py-2.5 text-[14px] text-white" style={{ background: BROWN, ...serif }}>제출하기</button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <p className="py-20 text-center text-[15px]" style={{ color: SUB }}>강의를 찾을 수 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
