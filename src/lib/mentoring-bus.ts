import { EventEmitter } from "node:events";
import type { MentoringRoom } from "@/lib/mentoring-store";

/**
 * 멘토링 방 변경 pub/sub. 보고서 저장·채팅·독서활동 변경 시 publish → 구독 중인 SSE 로 즉시 푸시.
 * HMR/중복 로드에도 하나의 emitter 를 쓰도록 globalThis 에 보관.
 */
const globalRef = globalThis as unknown as { __wjMentoringBus?: EventEmitter };
const bus = globalRef.__wjMentoringBus ?? new EventEmitter();
bus.setMaxListeners(0);
globalRef.__wjMentoringBus = bus;

function channel(courseId: string, studentId: string) {
  return `mentoring:${courseId}:${studentId}`;
}

export function publishMentoring(courseId: string, studentId: string, room: MentoringRoom) {
  bus.emit(channel(courseId, studentId), room);
}

export function subscribeMentoring(courseId: string, studentId: string, listener: (room: MentoringRoom) => void) {
  const event = channel(courseId, studentId);
  bus.on(event, listener);
  return () => {
    bus.off(event, listener);
  };
}
