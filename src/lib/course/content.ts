/**
 * 강의 포털 시드 콘텐츠 — 인공지능을 위한 선형대수학 (실제 커리큘럼).
 *
 * DB 없이 강의 포털 UI/UX 를 시연하기 위한 타입 + 데이터.
 * 구조: 코스 → 모듈(오리엔테이션 · 1~8주차 · 휴식기) → 블록 → 활동(세션).
 * 각 주차는 weekStart(시작일 00:00, KST)에 자동 활성화된다.
 */

export type ActivityKind = "page" | "resource" | "folder" | "assignment" | "forum";
export type MaterialType = "pdf" | "slide" | "doc" | "sheet" | "link";
export type CompletionMode = "auto" | "manual" | "none";

export type Material = {
  id: string;
  name: string;
  type: MaterialType;
  group?: string;
  href?: string;
  sizeLabel?: string;
};

export type LessonCard = {
  title: string;
  desc: string;
  durationMin: number;
  href?: string;
  accent?: "teal" | "navy";
};

export type Assignment = {
  prompt: string;
  instructions: string[];
  dueLabel?: string;
  allowText: boolean;
  allowFile: boolean;
  feedbackSample?: { grade?: string; comment: string; by: string };
};

export type Activity = {
  id: string;
  kind: ActivityKind;
  title: string;
  summary?: string;
  durationMin?: number;
  scheduleLabel?: string; // 세션 일시 (예: "8.17.(월) 19:00")
  completion: CompletionMode;
  body?: string[];
  cards?: LessonCard[];
  materials?: Material[];
  onlineResources?: { label: string; href: string }[];
  assignment?: Assignment;
  forumMeta?: { posts: number; unread: number };
};

export type Block = {
  banner: string;
  note?: string;
  activities: Activity[];
};

export type Module = {
  id: string;
  label: string;
  locked?: boolean;
  weekStart?: string; // 주차 시작일(YYYY-MM-DD, KST). 있으면 해당일 00:00에 활성화
  weekEnd?: string; // 기간 표시 종료일(없으면 시작일+6일)
  blocks: Block[];
};

export type Course = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  programme: string;
  category: string;
  instructor: { name: string; initials: string };
  summary: string;
  enrolled: { name: string; initials: string }[];
  bannerFrom: string;
  bannerTo: string;
  level?: string;
  stats?: { likes: number; students: number };
  references?: { label: string; href: string }[];
  audience?: string;
  format?: string;
  deliveryMode?: string;
  classDays?: string; // 수업 요일·시간 (예: "매주 월·수 19:00~20:30")
  timetable?: { day: string; time: string }[]; // 요일별 시간표
  periodLabel?: string;
  country?: string;
  modules: Module[];
};

// 세션 활동 생성 헬퍼
function session(
  id: string,
  scheduleLabel: string,
  title: string,
  body: string[],
  kind: ActivityKind = "page"
): Activity {
  return { id, kind, title, scheduleLabel, durationMin: 90, completion: "auto", body };
}

// ─────────────────────────────────────────────────────────────
// 시드 코스: 인공지능을 위한 선형대수학 (2026 하반기 · 매주 월·수 19:00~20:30)
// ─────────────────────────────────────────────────────────────

const linearAlgebraForAI: Course = {
  id: "ai-linalg",
  code: "ai_linalg_2026_online",
  title: "인공지능을 위한 선형대수학",
  subtitle: "AI를 떠받치는 수학 — 벡터에서 특이값 분해까지",
  programme: "2022개정 교육과정 교육감 승인 과목",
  category: "08/2026 · 온라인 실시간 워크숍",
  instructor: { name: "우아재 서재", initials: "齋" },
  summary:
    "매주 월·수 19:00~20:30 온라인 실시간 수업으로 진행되는 총 16회(32차시) 과정입니다. 자체 제작 교재와 Colab 실습으로 스칼라·벡터·행렬에서 시작해 최소제곱법, 고유값분해, 특이값 분해와 차원 축소(PCA)까지 다룹니다. 각 주차는 시작일 00:00에 열립니다.",
  enrolled: [
    { name: "이서준", initials: "이" },
    { name: "박하은", initials: "박" },
    { name: "정민서", initials: "정" },
    { name: "최유진", initials: "최" },
  ],
  bannerFrom: "#0A5AA0",
  bannerTo: "#00427E",
  level: "기본",
  stats: { likes: 214, students: 1583 },
  references: [
    { label: "Gilbert Strang's MIT 18.06", href: "#" },
    { label: "3Blue1Brown · 선형대수의 본질", href: "#" },
    { label: "Khan Academy · Linear Algebra", href: "#" },
  ],
  audience: "고등학생",
  format: "실시간수업",
  deliveryMode: "온라인",
  classDays: "매주 월·수 19:00~20:30 (싱가포르 표준시)",
  timetable: [
    { day: "월", time: "19:00 ~ 20:30" },
    { day: "수", time: "19:00 ~ 20:30" },
  ],
  periodLabel: "2026.8.17.(월) ~ 2026.11.4.(수)",
  country: "싱가포르",
  modules: [
    {
      id: "orientation",
      label: "오리엔테이션",
      blocks: [
        {
          banner: "오리엔테이션",
          note: "수업 시작 전, 아래 안내를 먼저 읽어주세요.",
          activities: [
            {
              id: "orientation-guide",
              kind: "page",
              title: "과정 안내와 학습 방법",
              durationMin: 10,
              completion: "auto",
              body: [
                "온라인 실시간 수업(줌)으로 매주 월·수 19:00~20:30, 총 16회 진행됩니다. 매 회차는 2차시로 구성됩니다.",
                "구글 계정과 Colab 접속을 미리 확인해 주세요. 자체 제작 교재와 학생별 실습 노트북이 배포됩니다.",
                "각 주차는 시작일 00:00에 자동으로 열립니다. 강의노트를 먼저 본 뒤 실습과 수행평가를 진행하세요.",
                "9.24.~10.25.는 탐구 프로젝트 기간으로, 탐구 보고서 작성과 발표 영상 제작을 진행합니다.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "w1",
      weekStart: "2026-08-17",
      label: "1주차: 선형대수의 기초",
      blocks: [
        {
          banner: "1주차 · 선형대수의 기초",
          note: "자체 제작 교재 · 학생별 실습 노트북 배포",
          activities: [
            session("w1-s1", "8.17.(월) 19:00", "오리엔테이션 · 1장 선형대수의 기초", [
              "과정 안내와 평가 방법 · 구글 계정과 Colab 접속 확인",
              "스칼라·벡터·행렬의 정의와 표기 · 행렬의 덧셈과 곱셈",
              "곱셈은 교환되지 않는다 (AB ≠ BA)",
            ]),
            session("w1-s2", "8.19.(수) 19:00", "실습 1. NumPy 기초", [
              "Colab 사용법 · np.array로 벡터와 행렬 만들기 · shape와 전치(.T)",
              "행렬 곱(@)과 크기 규칙 확인 · 실습 과제 3문항",
            ], "resource"),
          ],
        },
      ],
    },
    {
      id: "w2",
      weekStart: "2026-08-24",
      label: "2주차: 선형방정식과 선형시스템",
      blocks: [
        {
          banner: "2주차 · 선형방정식과 선형시스템",
          note: "자체 제작 교재",
          activities: [
            session("w2-s1", "8.24.(월) 19:00", "2장 선형방정식과 선형시스템", [
              "선형방정식의 정의 · 연립방정식을 Ax = b 로 옮기기",
              "역행렬로 해 구하기 · 역행렬이 없을 때(해가 없거나 무수히 많은 경우)",
            ]),
            session("w2-s2", "8.26.(수) 19:00", "실습 2. 역행렬과 연립방정식", [
              "문제를 행렬 A와 b로 옮기기 · 항등행렬과 np.linalg.inv",
              "np.linalg.solve로 해 구하기 · 행렬식과 특이행렬 판정 · 실습 과제 3문항",
            ], "resource"),
          ],
        },
      ],
    },
    {
      id: "w3",
      weekStart: "2026-08-31",
      label: "3주차: 선형결합과 선형독립",
      blocks: [
        {
          banner: "3주차 · 선형결합과 선형독립",
          note: "자체 제작 교재",
          activities: [
            session("w3-s1", "8.31.(월) 19:00", "3장 선형결합과 행렬곱의 네 관점", [
              "선형결합(Linear Combination)의 뜻 · Span의 기하적 의미",
              "행렬곱을 보는 네 가지 관점 — 내적 · 열의 결합 · 행의 결합 · 외적의 합",
            ]),
            session("w3-s2", "9.2.(수) 19:00", "4장 선형독립과 선형종속", [
              "선형독립과 선형종속의 정의 · 그림으로 이해하기",
              "해가 유일한가 — 독립성과 해의 개수 사이의 관계",
            ]),
          ],
        },
      ],
    },
    {
      id: "w4",
      weekStart: "2026-09-07",
      label: "4주차: 부분공간·랭크와 선형변환",
      blocks: [
        {
          banner: "4주차 · 부분공간·랭크와 선형변환",
          note: "★ 수행평가 1 부과 (1~5장, 실습 1·2) · 마감 9.13.(월) 12:00까지",
          activities: [
            session("w4-s1", "9.7.(월) 19:00", "5장 부분공간·기저·차원·랭크", [
              "부분공간(Subspace)의 뜻 · 기저와 차원 · 열공간과 랭크",
              "랭크로 해의 존재를 판정하기",
            ]),
            session("w4-s2", "9.9.(수) 19:00", "6장 선형변환과 신경망", [
              "함수로서의 변환 · 선형변환의 조건 · 표준행렬 구하기",
              "신경망의 한 층이 왜 행렬 곱인가 — 가중치 행렬과 편향",
            ]),
          ],
        },
      ],
    },
    {
      id: "w5",
      weekStart: "2026-09-14",
      label: "5주차: 전사·일대일과 내적·노름",
      blocks: [
        {
          banner: "5주차 · 전사·일대일과 내적·노름",
          note: "자체 제작 교재",
          activities: [
            session("w5-s1", "9.14.(월) 19:00", "7장 전사함수와 일대일함수", [
              "전사(ONTO)와 일대일(ONE-TO-ONE)의 정의 · 행렬로 판정하기",
              "신경망에서 차원이 늘고 주는 것의 의미",
            ]),
            session("w5-s2", "9.16.(수) 19:00", "8장 과결정시스템과 내적·노름", [
              "식이 미지수보다 많을 때 — 해가 없는 상황 · 내적(Inner Product)",
              "노름과 거리 · 각도와 직교성",
            ]),
          ],
        },
      ],
    },
    {
      id: "w6",
      weekStart: "2026-09-21",
      label: "6주차: 최소제곱법",
      blocks: [
        {
          banner: "6주차 · 최소제곱법",
          note: "★ 수행평가 2 마감 9.28.(월) 12:00까지",
          activities: [
            session("w6-s1", "9.21.(월) 19:00", "9장 최소제곱법과 정규방정식", [
              "어떤 답이 더 좋은가 — 오차를 재는 기준 · 수선의 발 내리기",
              "정규방정식 AᵀAx̂ = Aᵀb 의 유도와 의미",
            ]),
            session("w6-s2", "9.23.(수) 19:00", "실습 3. 최소제곱법", [
              "해가 없다는 것을 코드로 확인하기 · 여러 후보 답 비교하기",
              "정규방정식으로 풀기 · 잔차와 직교성으로 최소임을 검증하기 · 실습 과제 3문항",
            ], "resource"),
          ],
        },
      ],
    },
    {
      id: "break",
      weekStart: "2026-09-24",
      weekEnd: "2026-10-25",
      label: "탐구 프로젝트",
      blocks: [
        {
          banner: "탐구 프로젝트",
          note: "정규 수업이 없는 기간입니다.",
          activities: [
            {
              id: "break-report",
              kind: "page",
              title: "탐구 보고서 작성 및 발표 영상 제작",
              completion: "auto",
              body: [
                "9.24.~10.25. 탐구 프로젝트 기간입니다. 탐구 주제를 확정하고 데이터를 수집한 뒤, 탐구 보고서를 작성하고 발표 영상을 제작하세요.",
                "탐구 보고서와 발표 영상을 10.26.(월) 12:00까지 제출하세요.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "w7",
      weekStart: "2026-10-26",
      label: "7주차: 직교성·정사영과 고유값분해",
      blocks: [
        {
          banner: "7주차 · 직교성·정사영과 고유값분해",
          note: "탐구보고서 및 발표 영상 제출 — 10.26.(월) 12:00까지",
          activities: [
            session("w7-s1", "10.26.(월) 19:00", "10장 직교집합과 정사영 · 11장 그람슈미트와 QR분해", [
              "직교집합과 정규직교집합 · 정사영(Orthogonal Projection) · 정사영도 선형변환이다",
              "그람–슈미트 과정 · QR 분해와 최소제곱법에의 활용",
            ]),
            session("w7-s2", "10.28.(수) 19:00", "12장 고유벡터와 고유값 · 13장 대각화와 고유값분해", [
              "고유벡터의 정의와 기하적 의미 · 특성방정식으로 고유값 구하기",
              "대각화 A = VDV⁻¹ · 변환을 3단계로 나누어 보기 · 거듭제곱 계산에의 활용",
            ]),
          ],
        },
      ],
    },
    {
      id: "w8",
      weekStart: "2026-11-02",
      label: "8주차: 특이값 분해와 차원 축소",
      blocks: [
        {
          banner: "8주차 · 특이값 분해와 차원 축소",
          note: "전 과정 마무리 · 상호평가",
          activities: [
            session("w8-s1", "11.2.(월) 19:00", "14장 특이값 분해", [
              "A = UΣVᵀ 의 구조와 크기 · U, Σ, V 각각의 정체 · SVD는 외적의 합이다",
              "AAᵀ 와 AᵀA 로 SVD 구하는 법 · 고유값분해와 무엇이 다른가",
            ]),
            session("w8-s2", "11.4.(수) 19:00", "15장 저계수 근사와 차원 축소 · 전 과정 마무리", [
              "앞의 r개만 남기기 — 저계수 근사 · 얼마나 잃고 얼마나 아끼는가 · 차원 축소와 PCA",
              "서로의 발표 영상 보고 상호평가 · 1장부터 15장까지 전 과정 회고",
            ]),
          ],
        },
      ],
    },
  ],
};

export const COURSES: Course[] = [linearAlgebraForAI];

// ─────────────────────────────────────────────────────────────
// 조회 헬퍼
// ─────────────────────────────────────────────────────────────

export function getCourse(courseId: string): Course | undefined {
  return COURSES.find((c) => c.id === courseId);
}

export function allActivities(course: Course): Array<{ activity: Activity; module: Module; block: Block }> {
  const out: Array<{ activity: Activity; module: Module; block: Block }> = [];
  for (const module of course.modules) {
    for (const block of module.blocks) {
      for (const activity of block.activities) {
        out.push({ activity, module, block });
      }
    }
  }
  return out;
}

export function findActivity(course: Course, activityId: string) {
  return allActivities(course).find((x) => x.activity.id === activityId);
}

/** 완료 집계 대상(진도율 분모)이 되는 활동 id 목록 — completion !== "none" */
export function completableActivityIds(course: Course): string[] {
  return allActivities(course)
    .filter((x) => x.activity.completion !== "none")
    .map((x) => x.activity.id);
}

export function courseActivityHref(courseId: string, activityId: string): string {
  return `/course/${courseId}/a/${activityId}`;
}

// ── 주차 일정(활성화·기간) ─────────────────────────────────────
// weekStart(KST 날짜)를 절대시각으로 비교하므로 서버/클라 TZ 무관.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 주차 시작(KST 00:00)의 절대시각(ms) */
export function weekActivationMs(weekStart: string): number {
  const [y, m, d] = weekStart.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
}

/** 아직 열리지 않은 주차인지. weekStart 없으면 상시 열림(오리엔테이션 등) */
export function isModuleLocked(module: Module, nowMs: number = Date.now()): boolean {
  if (!module.weekStart) return false;
  return nowMs < weekActivationMs(module.weekStart);
}

function fmtMD(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCMonth() + 1}.${dt.getUTCDate()}.`;
}

/** "8.17.~8.23." (weekEnd 있으면 그 날짜까지, 없으면 시작일 + 6일) */
export function weekPeriodLabel(weekStart: string, weekEnd?: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  if (weekEnd) {
    const [ey, em, ed] = weekEnd.split("-").map(Number);
    return `${fmtMD(y, m, d)}~${fmtMD(ey, em, ed)}`;
  }
  return `${fmtMD(y, m, d)}~${fmtMD(y, m, d + 6)}`;
}

/** "8.17. 오픈" */
export function weekOpenLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  return `${fmtMD(y, m, d)} 오픈`;
}
