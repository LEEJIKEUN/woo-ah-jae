"use client";

/**
 * 강의 포털 완료(Done) 상태 컨텍스트.
 * 서버(LessonCompletion)를 정본으로 사용하고, localStorage 는 오프라인 캐시로 병행.
 * 토글 시 낙관적 갱신 + 서버 POST. 학부모가 자녀 진도를 조회하는 근거가 서버 기록이다.
 * 드로어 진도 도넛과 활동 행의 Done 배지가 같은 상태를 공유하도록 Provider 로 감싼다.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { doneKey } from "@/lib/course/progress";

type CompletionContextValue = {
  done: Set<string>;
  isDone: (id: string) => boolean;
  toggle: (id: string, next?: boolean) => void;
  doneCount: number;
};

const CompletionContext = createContext<CompletionContextValue | null>(null);

export function CompletionProvider({
  courseId,
  children,
}: {
  courseId: string;
  children: React.ReactNode;
}) {
  const key = doneKey(courseId);
  const [done, setDone] = useState<Set<string>>(new Set());

  const persist = useCallback(
    (set: Set<string>) => {
      try {
        window.localStorage.setItem(key, JSON.stringify([...set]));
      } catch {
        /* ignore */
      }
    },
    [key]
  );

  // 초기 로드: localStorage 로 즉시 표시 → 서버 기록으로 덮어씀(정본)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/completion`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { done?: string[] };
        if (!alive || !Array.isArray(data.done)) return;
        // 서버 기록 ∪ 방금 자동완료된 로컬 상태(뷰 진입 자동완료가 provider 로드보다 먼저 실행됨)
        setDone((prev) => {
          const set = new Set([...prev, ...data.done!]);
          persist(set);
          return set;
        });
      } catch {
        /* 오프라인/비로그인 → localStorage 유지 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId, key, persist]);

  const toggle = useCallback(
    (id: string, next?: boolean) => {
      let willDone = false;
      setDone((prev) => {
        const set = new Set(prev);
        willDone = next === undefined ? !set.has(id) : next;
        if (willDone) set.add(id);
        else set.delete(id);
        persist(set);
        return set;
      });
      // 서버 기록(낙관적) — 실패해도 로컬 상태는 유지
      void fetch(`/api/courses/${courseId}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: id, done: willDone }),
      }).catch(() => {});
    },
    [courseId, persist]
  );

  const isDone = useCallback((id: string) => done.has(id), [done]);

  return (
    <CompletionContext.Provider value={{ done, isDone, toggle, doneCount: done.size }}>
      {children}
    </CompletionContext.Provider>
  );
}

export function useCompletion(): CompletionContextValue {
  const ctx = useContext(CompletionContext);
  if (!ctx) throw new Error("useCompletion must be used within CompletionProvider");
  return ctx;
}
