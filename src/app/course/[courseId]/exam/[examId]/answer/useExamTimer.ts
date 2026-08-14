import { useEffect, useRef, useState } from "react";

/**
 * 서버 권위 절대시각 타이머.
 * - 클라 시계를 신뢰하지 않는다: 최초 1회 offset = serverNow - clientNow 를 구하고,
 *   매 틱 remaining = deadlineAt - (Date.now() + offset) 로 재계산(카운터 감소 금지).
 * - 탭 비활성으로 setInterval 이 throttle 돼도 절대시각 기준이라 값이 어긋나지 않는다.
 * - 다시 보일 때(visibilitychange) 즉시 재계산해 드리프트를 보정한다.
 * - remaining <= 0 이 되는 순간 onExpire 를 딱 한 번 호출한다.
 */
export function useExamTimer(deadlineAtISO: string | null, serverNowISO: string | null, onExpire: () => void): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const offsetRef = useRef(0);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!deadlineAtISO || !serverNowISO) return;
    offsetRef.current = Date.parse(serverNowISO) - Date.now();
    const deadline = Date.parse(deadlineAtISO);

    const compute = () => {
      const rem = deadline - (Date.now() + offsetRef.current);
      setRemainingMs(rem);
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };

    compute();
    const t = setInterval(compute, 1000);
    const onVis = () => { if (document.visibilityState === "visible") compute(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [deadlineAtISO, serverNowISO]);

  return remainingMs;
}
