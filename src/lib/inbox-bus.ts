import { EventEmitter } from "node:events";

/**
 * 알림·메시지 배지 실시간 갱신용 pub/sub. 이벤트 발생 시 해당 사용자(또는 강좌 스태프)에게
 * 'refresh' 신호를 보내고, 헤더 SSE 가 이를 받아 카운트를 다시 불러온다.
 */
const globalRef = globalThis as unknown as { __wjInboxBus?: EventEmitter };
const bus = globalRef.__wjInboxBus ?? new EventEmitter();
bus.setMaxListeners(0);
globalRef.__wjInboxBus = bus;

export function pingUser(userId: string) {
  if (userId) bus.emit(`user:${userId}`);
}
export function pingCourseStaff(courseId: string) {
  if (courseId) bus.emit(`course-staff:${courseId}`);
}
export function subscribeInbox(channels: string[], listener: () => void) {
  channels.forEach((c) => bus.on(c, listener));
  return () => channels.forEach((c) => bus.off(c, listener));
}
