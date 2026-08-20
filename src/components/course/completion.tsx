"use client";

/**
 * 강의 포털 완료(Done) 상태 컨텍스트.
 * 서버(LessonCompletion)를 정본으로 사용하고, localStorage 는 오프라인 캐시로 병행.
 * 토글 시 낙관적 갱신 + 서버 POST. 학부모가 자녀 진도를 조회하는 근거가 서버 기록이다.
 * 드로어 진도 도넛과 활동 행의 Done 배지가 같은 상태를 공유하도록 Provider 로 감싼다.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { doneKey } from "@/lib/course/progress";

const COMPLETION_POLL_MS = 5000; // 교사 출석 체크를 학생 화면에 실시간 반영(5초 폴링)

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
  // 학생 본인이 방금 토글한 항목(서버 반영 확인 전) — 폴링이 덮어쓰지 않도록 잠시 유지
  const pendingRef = useRef<Map<string, boolean>>(new Map());

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

  // 서버 기록을 정본으로 반영(교사 출석 체크/해제 실시간 반영). 단, 본인 최근 토글(pending)은 우선.
  const applyServer = useCallback(
    (serverIds: string[]) => {
      setDone(() => {
        const set = new Set(serverIds);
        pendingRef.current.forEach((willDone, id) => { if (willDone) set.add(id); else set.delete(id); });
        persist(set);
        return set;
      });
    },
    [persist]
  );

  // 초기 로드: localStorage 즉시 표시 → 서버 기록으로 정본화. 이후 5초마다 폴링(교사 변경 실시간 반영).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/completion`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { done?: string[] };
        if (alive && Array.isArray(data.done)) applyServer(data.done);
      } catch {
        /* 오프라인/비로그인 → 현재 상태 유지 */
      }
    };
    void pull();
    const t = setInterval(() => void pull(), COMPLETION_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [courseId, key, applyServer]);

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
      pendingRef.current.set(id, willDone); // 폴링이 덮어쓰지 않도록 표시
      // 서버 기록(낙관적) — 실패해도 로컬 상태는 유지. 저장 후 잠시 뒤 pending 해제(서버가 정본).
      void fetch(`/api/courses/${courseId}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: id, done: willDone }),
      })
        .then(() => { setTimeout(() => pendingRef.current.delete(id), 3000); })
        .catch(() => { pendingRef.current.delete(id); });
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
