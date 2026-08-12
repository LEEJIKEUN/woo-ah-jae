"use client";

/**
 * 강의 포털 완료(Done) 상태 컨텍스트.
 * 데모 단계라 localStorage 에만 저장(코스별 키). 나중에 서버 완료기록 API 로 교체 가능.
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [key]);

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

  const toggle = useCallback(
    (id: string, next?: boolean) => {
      setDone((prev) => {
        const set = new Set(prev);
        const willDone = next === undefined ? !set.has(id) : next;
        if (willDone) set.add(id);
        else set.delete(id);
        persist(set);
        return set;
      });
    },
    [persist]
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
