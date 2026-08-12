/**
 * 관리자가 개설한 강좌를 브라우저에 저장(데모용 localStorage).
 * 나중에 Prisma 백엔드로 교체 가능 — 이 함수들만 서버 API 호출로 바꾸면 됨.
 * (localStorage 접근이므로 클라이언트 컨텍스트에서만 호출)
 */
export type StoredLesson = {
  id: string;
  title: string;
  kind: "material" | "assignment"; // 강의자료 / 과제
  body: string;
};

export type StoredModule = { label: string; lessons: StoredLesson[] };

export type StoredCourse = {
  id: string;
  title: string;
  subtitle: string;
  programme: string;
  audience: string;
  format: string;
  deliveryMode: string;
  periodLabel: string;
  country: string;
  summary: string;
  modules: StoredModule[];
  createdAt: string;
};

const KEY = "wj_custom_courses";

export function getStoredCourses(): StoredCourse[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredCourse[]) : [];
  } catch {
    return [];
  }
}

export function getStoredCourse(id: string): StoredCourse | null {
  return getStoredCourses().find((c) => c.id === id) ?? null;
}

export function saveStoredCourse(course: StoredCourse) {
  try {
    const all = getStoredCourses().filter((c) => c.id !== course.id);
    all.push(course);
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** 고유 id (클라이언트 핸들러에서 호출 — Date/Math 사용 OK) */
export function newId(prefix = "c"): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
export function newCourseId(): string {
  return newId("c");
}
