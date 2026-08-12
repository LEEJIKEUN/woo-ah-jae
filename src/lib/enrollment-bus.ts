import { EventEmitter } from "node:events";

/**
 * 수강신청 현황 변경 pub/sub (프로세스 내).
 * POST 신청이 들어오면 publish → 해당 강좌를 구독 중인 모든 SSE 스트림에 즉시 푸시.
 * HMR/중복 로드에도 하나의 emitter 를 쓰도록 globalThis 에 보관.
 * (서버리스 다중 인스턴스로 이전 시 Redis pub/sub 등 외부 브로커로 교체 필요.)
 */
export type EnrollmentPayload = { applied: number; capacity: number; full: boolean };

const globalRef = globalThis as unknown as { __wjEnrollmentBus?: EventEmitter };
const bus = globalRef.__wjEnrollmentBus ?? new EventEmitter();
bus.setMaxListeners(0); // 다수 SSE 연결 허용
globalRef.__wjEnrollmentBus = bus;

function channel(courseId: string) {
  return `enroll:${courseId}`;
}

export function publishEnrollment(courseId: string, payload: EnrollmentPayload) {
  bus.emit(channel(courseId), payload);
}

export function subscribeEnrollment(courseId: string, listener: (payload: EnrollmentPayload) => void) {
  const event = channel(courseId);
  bus.on(event, listener);
  return () => {
    bus.off(event, listener);
  };
}
