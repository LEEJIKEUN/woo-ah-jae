import type { Course } from "../content";

/**
 * 강좌: 미적분 I
 * 복제 생성 2026-08-18 — 원본 "인공지능을 위한 선형대수학" (ai-linalg) 의 구성을 그대로 복제.
 *
 * ★ 시드 강좌와 완전히 동일한 메뉴·기능(게시판·멘토링·시험·현황·출석·강의)을 갖습니다.
 * ★ 기본 상태는 비공개(private) — 관리자에게만 보입니다. 공개하려면 관리자 화면에서 상태를 바꾸거나
 *    아래 defaultStatus 를 "open" 등으로 변경하세요.
 * ★ 아래 내용은 원본에서 복사된 것이므로, 새 강좌에 맞게 자유롭게 수정하세요.
 *    - 주차 날짜(weekStart/weekEnd/scheduleLabel/periodLabel), 세션 제목·본문
 *    - 강의자료(materials.href) 경로는 아직 원본(ai-linalg)을 가리킵니다 → 새 자료로 교체 필요
 */
export const calculus1: Course = {
  id: "calculus-1",
  code: "calculus_1",
  title: "미적분 I",
  subtitle: "AI를 떠받치는 수학 — 벡터에서 특이값 분해까지",
  programme: "2022개정 교육과정 교육감 승인 과목",
  category: "08/2026 · 온라인 실시간 워크숍",
  instructor: {
    name: "우아재 서재",
    initials: "齋"
  },
  summary: "매주 월·수 19:00~20:30 온라인 실시간 수업으로 진행되는 총 16회(32차시) 과정입니다. 자체 제작 교재와 Colab 실습으로 스칼라·벡터·행렬에서 시작해 최소제곱법, 고유값분해, 특이값 분해와 차원 축소(PCA)까지 다룹니다. 각 주차는 시작일 00:00에 열립니다.",
  enrolled: [],
  bannerFrom: "#0A5AA0",
  bannerTo: "#00427E",
  level: "기본",
  stats: {
    likes: 214,
    students: 1583
  },
  references: [
    {
      label: "Gilbert Strang's MIT 18.06",
      href: "#"
    },
    {
      label: "3Blue1Brown · 선형대수의 본질",
      href: "#"
    },
    {
      label: "Khan Academy · Linear Algebra",
      href: "#"
    }
  ],
  audience: "고등학생",
  objectives: "벡터·행렬의 연산을 정의하고 손과 코드로 계산할 수 있다.\n연립방정식을 행렬로 표현하고 가우스 소거법으로 풀 수 있다.\n최소제곱법으로 데이터에 가장 잘 맞는 직선·평면을 구할 수 있다.\n고유값·고유벡터의 의미를 이해하고 직접 구할 수 있다.\n특이값 분해(SVD)와 주성분 분석(PCA)으로 데이터를 차원 축소할 수 있다.\nColab에서 NumPy로 선형대수 연산을 구현하고 결과를 해석할 수 있다.",
  format: "실시간수업",
  deliveryMode: "온라인",
  classDays: "매주 월·수 19:00~20:30 (싱가포르 표준시)",
  timetable: [
    {
      day: "월",
      time: "19:00 ~ 20:30"
    },
    {
      day: "수",
      time: "19:00 ~ 20:30"
    }
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
                "9.24.~10.25.는 탐구 프로젝트 기간으로, 탐구 보고서 작성과 발표 영상 제작을 진행합니다."
              ]
            }
          ]
        }
      ]
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
            {
              id: "w1-s1",
              kind: "page",
              title: "오리엔테이션 · 1장 선형대수의 기초",
              scheduleLabel: "8.17.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "과정 안내와 평가 방법 · 구글 계정과 Colab 접속 확인",
                "스칼라·벡터·행렬의 정의와 표기 · 행렬의 덧셈과 곱셈",
                "곱셈은 교환되지 않는다 (AB ≠ BA)"
              ],
              materials: [
                {
                  id: "note-01",
                  name: "선형대수의 기초 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch01.pdf",
                  sizeLabel: "1.1MB"
                }
              ]
            },
            {
              id: "w1-s2",
              kind: "resource",
              title: "실습 1. NumPy 기초",
              scheduleLabel: "8.19.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "Colab 사용법 · np.array로 벡터와 행렬 만들기 · shape와 전치(.T)",
                "행렬 곱(@)과 크기 규칙 확인 · 실습 과제 3문항"
              ],
              materials: [
                {
                  id: "lab-1",
                  name: "NumPy 기초 · 실습지(PDF)",
                  type: "pdf",
                  group: "실습자료",
                  href: "/materials/ai-linalg/labs/lab1.pdf",
                  sizeLabel: "778KB"
                },
                {
                  id: "colab-colab-lab1",
                  name: "실습1 NumPy 기초 · Colab 노트북(.ipynb)",
                  type: "link",
                  group: "실습자료",
                  href: "/materials/ai-linalg/labs/colab-lab1.ipynb",
                  sizeLabel: "9KB"
                }
              ]
            }
          ]
        }
      ]
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
            {
              id: "w2-s1",
              kind: "page",
              title: "2장 선형방정식과 선형시스템",
              scheduleLabel: "8.24.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "선형방정식의 정의 · 연립방정식을 Ax = b 로 옮기기",
                "역행렬로 해 구하기 · 역행렬이 없을 때(해가 없거나 무수히 많은 경우)"
              ],
              materials: [
                {
                  id: "note-02",
                  name: "선형방정식과 선형시스템 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch02.pdf",
                  sizeLabel: "1016KB"
                }
              ]
            },
            {
              id: "w2-s2",
              kind: "resource",
              title: "실습 2. 역행렬과 연립방정식",
              scheduleLabel: "8.26.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "문제를 행렬 A와 b로 옮기기 · 항등행렬과 np.linalg.inv",
                "np.linalg.solve로 해 구하기 · 행렬식과 특이행렬 판정 · 실습 과제 3문항"
              ],
              materials: [
                {
                  id: "lab-2",
                  name: "역행렬과 연립방정식 · 실습지(PDF)",
                  type: "pdf",
                  group: "실습자료",
                  href: "/materials/ai-linalg/labs/lab2.pdf",
                  sizeLabel: "672KB"
                },
                {
                  id: "colab-colab-lab2",
                  name: "실습2 역행렬과 연립방정식 · Colab 노트북(.ipynb)",
                  type: "link",
                  group: "실습자료",
                  href: "/materials/ai-linalg/labs/colab-lab2.ipynb",
                  sizeLabel: "9KB"
                }
              ]
            }
          ]
        }
      ]
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
            {
              id: "w3-s1",
              kind: "page",
              title: "3장 선형결합과 행렬곱의 네 관점",
              scheduleLabel: "8.31.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "선형결합(Linear Combination)의 뜻 · Span의 기하적 의미",
                "행렬곱을 보는 네 가지 관점 — 내적 · 열의 결합 · 행의 결합 · 외적의 합"
              ],
              materials: [
                {
                  id: "note-03",
                  name: "선형결합과 행렬곱의 네 관점 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch03.pdf",
                  sizeLabel: "1.1MB"
                }
              ]
            },
            {
              id: "w3-s2",
              kind: "page",
              title: "4장 선형독립과 선형종속",
              scheduleLabel: "9.2.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "선형독립과 선형종속의 정의 · 그림으로 이해하기",
                "해가 유일한가 — 독립성과 해의 개수 사이의 관계"
              ],
              materials: [
                {
                  id: "note-04",
                  name: "선형독립과 선형종속 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch04.pdf",
                  sizeLabel: "886KB"
                }
              ]
            }
          ]
        }
      ]
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
            {
              id: "w4-s1",
              kind: "page",
              title: "5장 부분공간·기저·차원·랭크",
              scheduleLabel: "9.7.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "부분공간(Subspace)의 뜻 · 기저와 차원 · 열공간과 랭크",
                "랭크로 해의 존재를 판정하기"
              ],
              materials: [
                {
                  id: "note-05",
                  name: "부분공간·기저·차원·랭크 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch05.pdf",
                  sizeLabel: "845KB"
                }
              ]
            },
            {
              id: "w4-s2",
              kind: "page",
              title: "6장 선형변환과 신경망",
              scheduleLabel: "9.9.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "함수로서의 변환 · 선형변환의 조건 · 표준행렬 구하기",
                "신경망의 한 층이 왜 행렬 곱인가 — 가중치 행렬과 편향"
              ],
              materials: [
                {
                  id: "note-06",
                  name: "선형변환과 신경망 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch06.pdf",
                  sizeLabel: "879KB"
                }
              ]
            }
          ]
        }
      ]
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
            {
              id: "w5-s1",
              kind: "page",
              title: "7장 전사함수와 일대일함수",
              scheduleLabel: "9.14.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "전사(ONTO)와 일대일(ONE-TO-ONE)의 정의 · 행렬로 판정하기",
                "신경망에서 차원이 늘고 주는 것의 의미"
              ],
              materials: [
                {
                  id: "note-07",
                  name: "전사함수와 일대일함수 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch07.pdf",
                  sizeLabel: "889KB"
                }
              ]
            },
            {
              id: "w5-s2",
              kind: "page",
              title: "8장 과결정시스템과 내적·노름",
              scheduleLabel: "9.16.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "식이 미지수보다 많을 때 — 해가 없는 상황 · 내적(Inner Product)",
                "노름과 거리 · 각도와 직교성"
              ],
              materials: [
                {
                  id: "note-08",
                  name: "과결정시스템과 내적·노름 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch08.pdf",
                  sizeLabel: "963KB"
                }
              ]
            }
          ]
        }
      ]
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
            {
              id: "w6-s1",
              kind: "page",
              title: "9장 최소제곱법과 정규방정식",
              scheduleLabel: "9.21.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "어떤 답이 더 좋은가 — 오차를 재는 기준 · 수선의 발 내리기",
                "정규방정식 AᵀAx̂ = Aᵀb 의 유도와 의미"
              ],
              materials: [
                {
                  id: "note-09",
                  name: "최소제곱법과 정규방정식 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch09.pdf",
                  sizeLabel: "992KB"
                }
              ]
            },
            {
              id: "w6-s2",
              kind: "resource",
              title: "실습 3. 최소제곱법",
              scheduleLabel: "9.23.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "해가 없다는 것을 코드로 확인하기 · 여러 후보 답 비교하기",
                "정규방정식으로 풀기 · 잔차와 직교성으로 최소임을 검증하기 · 실습 과제 3문항"
              ],
              materials: [
                {
                  id: "lab-3",
                  name: "최소제곱법 · 실습지(PDF)",
                  type: "pdf",
                  group: "실습자료",
                  href: "/materials/ai-linalg/labs/lab3.pdf",
                  sizeLabel: "872KB"
                },
                {
                  id: "colab-colab-lab3",
                  name: "실습3 최소제곱법 · Colab 노트북(.ipynb)",
                  type: "link",
                  group: "실습자료",
                  href: "/materials/ai-linalg/labs/colab-lab3.ipynb",
                  sizeLabel: "12KB"
                },
                {
                  id: "colab-colab-linreg3",
                  name: "선형회귀 3변수(응용) · Colab 노트북(.ipynb)",
                  type: "link",
                  group: "실습자료",
                  href: "/materials/ai-linalg/labs/colab-linreg3.ipynb",
                  sizeLabel: "16KB"
                }
              ]
            }
          ]
        }
      ]
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
                "아래 데이터 양식과 샘플을 참고해 데이터를 정리하세요."
              ],
              materials: [
                {
                  id: "xlsx-project-data-template",
                  name: "프로젝트 데이터 양식",
                  type: "sheet",
                  group: "프로젝트 양식",
                  href: "/materials/ai-linalg/project/project-data-template.xlsx",
                  sizeLabel: "7KB"
                },
                {
                  id: "xlsx-project-data-sample",
                  name: "프로젝트 데이터 양식(작성 샘플)",
                  type: "sheet",
                  group: "프로젝트 양식",
                  href: "/materials/ai-linalg/project/project-data-sample.xlsx",
                  sizeLabel: "12KB"
                }
              ]
            }
          ]
        }
      ]
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
            {
              id: "w7-s1",
              kind: "page",
              title: "10장 직교집합과 정사영 · 11장 그람슈미트와 QR분해",
              scheduleLabel: "10.26.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "직교집합과 정규직교집합 · 정사영(Orthogonal Projection) · 정사영도 선형변환이다",
                "그람–슈미트 과정 · QR 분해와 최소제곱법에의 활용"
              ],
              materials: [
                {
                  id: "note-10",
                  name: "직교집합과 정사영 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch10.pdf",
                  sizeLabel: "769KB"
                },
                {
                  id: "note-11",
                  name: "그람슈미트와 QR분해 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch11.pdf",
                  sizeLabel: "879KB"
                }
              ]
            },
            {
              id: "w7-s2",
              kind: "page",
              title: "12장 고유벡터와 고유값 · 13장 대각화와 고유값분해",
              scheduleLabel: "10.28.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "고유벡터의 정의와 기하적 의미 · 특성방정식으로 고유값 구하기",
                "대각화 A = VDV⁻¹ · 변환을 3단계로 나누어 보기 · 거듭제곱 계산에의 활용"
              ],
              materials: [
                {
                  id: "note-12",
                  name: "고유벡터와 고유값 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch12.pdf",
                  sizeLabel: "941KB"
                },
                {
                  id: "note-13",
                  name: "대각화와 고유값분해 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch13.pdf",
                  sizeLabel: "1013KB"
                }
              ]
            }
          ]
        }
      ]
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
            {
              id: "w8-s1",
              kind: "page",
              title: "14장 특이값 분해",
              scheduleLabel: "11.2.(월) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "A = UΣVᵀ 의 구조와 크기 · U, Σ, V 각각의 정체 · SVD는 외적의 합이다",
                "AAᵀ 와 AᵀA 로 SVD 구하는 법 · 고유값분해와 무엇이 다른가"
              ],
              materials: [
                {
                  id: "note-14",
                  name: "특이값 분해 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch14.pdf",
                  sizeLabel: "1.0MB"
                }
              ]
            },
            {
              id: "w8-s2",
              kind: "page",
              title: "15장 저계수 근사와 차원 축소 · 전 과정 마무리",
              scheduleLabel: "11.4.(수) 19:00",
              durationMin: 90,
              completion: "auto",
              body: [
                "앞의 r개만 남기기 — 저계수 근사 · 얼마나 잃고 얼마나 아끼는가 · 차원 축소와 PCA",
                "서로의 발표 영상 보고 상호평가 · 1장부터 15장까지 전 과정 회고"
              ],
              materials: [
                {
                  id: "note-15",
                  name: "저계수 근사와 차원 축소 · 강의노트(PDF)",
                  type: "pdf",
                  group: "강의노트",
                  href: "/materials/ai-linalg/notes/ch15.pdf",
                  sizeLabel: "800KB"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  defaultStatus: "private"
};
