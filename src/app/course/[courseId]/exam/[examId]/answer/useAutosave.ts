import { useCallback, useEffect, useRef, useState } from "react";

export type QAnswer = { choice: number | null; textAnswer: string | null };
export type AnswerMap = Record<number, QAnswer>;
export type SaveState = "idle" | "saving" | "saved" | "error";

export type LocalBackup = { answers: AnswerMap; updatedAt: Record<number, number> };

export const localKeyFor = (attemptId: string) => `exam-attempt:${attemptId}`;

export function readLocalBackup(attemptId: string): LocalBackup | null {
  try {
    const raw = localStorage.getItem(localKeyFor(attemptId));
    if (!raw) return null;
    const p = JSON.parse(raw) as LocalBackup;
    if (!p || typeof p !== "object" || !p.answers) return null;
    return { answers: p.answers ?? {}, updatedAt: p.updatedAt ?? {} };
  } catch {
    return null;
  }
}

export function clearLocalBackup(attemptId: string) {
  try {
    localStorage.removeItem(localKeyFor(attemptId));
  } catch {
    /* 무시 */
  }
}

const DEBOUNCE_MS = 1500;
const HEARTBEAT_MS = 20_000;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30_000;

type Params = {
  url: string; // 저장 엔드포인트
  attemptId: string;
  getAnswers: () => AnswerMap; // 현재 전체 답안
  active: boolean; // in_progress 동안만 저장
  onLocked: (status: string) => void; // 서버가 expired/submitted 로 잠금 응답 시
};

/**
 * 답안 자동저장 — 유실 방지 최우선.
 * - 변경 1.5s debounce 저장 + 20s heartbeat + visibilitychange/pagehide 즉시(keepalive) 저장
 * - 저장과 동시에 localStorage 백업(문항별 updatedAt). 실패 시 지수 백오프 재시도.
 * - 항상 upsert(변경 문항만 전송). 저장 실패는 상태로 노출(조용히 넘어가지 않음).
 */
export function useAutosave({ url, attemptId, getAnswers, active, onLocked }: Params) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const dirtyRef = useRef<Set<number>>(new Set());
  const localUpdatedRef = useRef<Record<number, number>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(RETRY_BASE_MS);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const stoppedRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const writeLocal = useCallback(() => {
    try {
      const backup: LocalBackup = { answers: getAnswers(), updatedAt: localUpdatedRef.current };
      localStorage.setItem(localKeyFor(attemptId), JSON.stringify(backup));
    } catch {
      /* 저장소 가득 참 등 무시 */
    }
  }, [attemptId, getAnswers]);

  const flush = useCallback(
    async (keepalive = false) => {
      if (stoppedRef.current || !activeRef.current) return;
      if (inFlightRef.current) { pendingRef.current = true; return; }

      const nos = Array.from(dirtyRef.current);
      const answers = getAnswers();
      const payload = nos.map((n) => ({ questionNo: n, choice: answers[n]?.choice ?? null, textAnswer: answers[n]?.textAnswer ?? null }));

      inFlightRef.current = true;
      setState("saving");
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: payload }),
          keepalive,
        });
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; rejected?: boolean; status?: string; lastSavedAt?: string };
        if (!res.ok) throw new Error("save failed");
        if (d.rejected) {
          stoppedRef.current = true;
          onLocked(d.status ?? "expired");
          return;
        }
        // 성공: 전송한 문항만 dirty 해제(전송 중 새로 바뀐 건 유지)
        nos.forEach((n) => dirtyRef.current.delete(n));
        backoffRef.current = RETRY_BASE_MS;
        setLastSavedAt(d.lastSavedAt ? Date.parse(d.lastSavedAt) : Date.now());
        setState("saved");
      } catch {
        setState("error");
        // 재시도 예약(지수 백오프) — dirty 는 유지되어 다음에 재전송
        if (!stoppedRef.current) {
          if (retryRef.current) clearTimeout(retryRef.current);
          retryRef.current = setTimeout(() => void flush(), backoffRef.current);
          backoffRef.current = Math.min(backoffRef.current * 2, RETRY_MAX_MS);
        }
      } finally {
        inFlightRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          void flush();
        }
      }
    },
    [url, getAnswers, onLocked]
  );

  const markChanged = useCallback(
    (questionNo: number, opts?: { immediate?: boolean }) => {
      dirtyRef.current.add(questionNo);
      localUpdatedRef.current[questionNo] = Date.now();
      writeLocal(); // 즉시 로컬 백업
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // 객관식 마킹 등 이산 변경은 즉시 저장 → 스태프 명렬표에 실시간 반영. 주관식 타이핑은 debounce.
      if (opts?.immediate) void flush();
      else debounceRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [flush, writeLocal]
  );

  const flushNow = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await flush();
  }, [flush]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);
  }, []);

  // heartbeat: 변경 여부와 무관하게 주기적으로 저장(lastSavedAt 갱신)
  useEffect(() => {
    const t = setInterval(() => { if (active) void flush(); }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [active, flush]);

  // 탭 숨김/이탈 시 즉시 저장(keepalive)
  useEffect(() => {
    const onHide = () => { if (activeRef.current && dirtyRef.current.size) void flush(true); };
    const onVis = () => { if (document.visibilityState === "hidden") onHide(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flush]);

  return { state, lastSavedAt, markChanged, flushNow, stop };
}
