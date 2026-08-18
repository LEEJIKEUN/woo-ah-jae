import { EventEmitter } from "node:events";
import { buildLiveCell, type LiveCell } from "./progress";

/**
 * 시험 응시 현황 실시간 pub/sub (프로세스 내). 강좌 단위 채널.
 * 학생이 답안을 저장/제출하거나 응시를 시작하면 publish → 스태프 명렬표 SSE 로 즉시 푸시.
 * (서버리스 다중 인스턴스로 이전 시 Redis 등 외부 브로커로 교체 필요.)
 */
export type ExamProgressPayload = { examId: string; studentId: string; cell: LiveCell };

const globalRef = globalThis as unknown as { __wjExamBus?: EventEmitter };
const bus = globalRef.__wjExamBus ?? new EventEmitter();
bus.setMaxListeners(0); // 다수 SSE 연결 허용
globalRef.__wjExamBus = bus;

const channel = (courseId: string) => `exam:${courseId}`;

export function publishExamProgress(courseId: string, payload: ExamProgressPayload) {
  bus.emit(channel(courseId), payload);
}

export function subscribeExamProgress(courseId: string, listener: (payload: ExamProgressPayload) => void) {
  const event = channel(courseId);
  bus.on(event, listener);
  return () => {
    bus.off(event, listener);
  };
}

/**
 * 학생의 현재 셀을 계산해 스태프 명렬표로 즉시 푸시(best-effort).
 * 답안 저장/제출/응시시작 라우트에서 fire-and-forget 으로 호출한다(학생 응답 지연 방지).
 */
export async function notifyExamProgress(courseId: string, examId: string, studentId: string): Promise<void> {
  try {
    const cell = await buildLiveCell(examId, studentId);
    if (cell) publishExamProgress(courseId, { examId, studentId, cell });
  } catch {
    /* 실시간 푸시 실패는 응시/저장을 막지 않는다 */
  }
}
