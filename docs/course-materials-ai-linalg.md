# 인공지능을 위한 선형대수학 — 강의자료 세팅 정리

원본 폴더: `~/Desktop/인공지능을 위한 선형대수학 최종` (총 154개 파일, 110MB)

## 1. 사이트에 게시한 자료 (학생 공개)

정적 파일로 `public/materials/ai-linalg/` 에 배치 → 배포 시 실제 URL로 제공됨
(`https://wooahjae.com/materials/ai-linalg/...`). 각 레슨 하단 **강의자료** 섹션에서 다운로드.

| 파일(사이트) | 원본 | 배치 주차/세션 |
|---|---|---|
| notes/ch01.pdf ~ ch15.pdf | 교재/PDF_학생용/01~15_*.pdf (학생용) | 1~8주차 각 장 세션 |
| labs/lab1.pdf ~ lab3.pdf | 교재/PDF_학생용/실습1~3_*.pdf | 실습 세션(w1-s2, w2-s2, w6-s2) |
| labs/colab-lab1~3.ipynb | 교재/[Colab] 실습1~3_*.ipynb | 실습 세션 |
| labs/colab-linreg3.ipynb | 교재/[Colab] 선형회귀_3변수_수업용.ipynb | w6-s2 (응용) |
| project/project-data-template.xlsx | 교재/프로젝트_데이터양식.xlsx | 탐구 프로젝트(break) |
| project/project-data-sample.xlsx | 교재/프로젝트_데이터양식 샘플.xlsx | 탐구 프로젝트(break) |

장→주차 매핑은 `src/lib/course/content.ts` 시드에 반영(각 `session(...)` 의 materials 인자).

## 2. 의도적으로 게시하지 않은 자료 (관리자·퍼실리테이터 전용)

- **교사용/수업용 PDF** (`교재/PDF_교사용/`, `교재/PDF_수업용/`, `교재/*_교사용.html`) — 학생 비공개.
- **학생별 실습 노트북** (`교재/실습_학생별/실습_XX_이름.ipynb`, 19개) — 개인정보(이름) 포함, 공개 금지.
- **MIT 18.06(s10) 원문 자료** — `exam1~3_s10*`, `pset1~10_s10*`, `Intro/Appendix/Further_Study/Final_Exam/Final_Answers.pdf`, 루트의 중복/구버전 PDF. 영어 원자료·참고용.
- **[운영] 강의계획 및 평가계획.xlsx** — 운영 문서.

필요 시: 관리자/퍼실리테이터로 로그인 → 해당 레슨 → 하단 편집기(LessonBlocks)에서
파일 블록으로 개별 업로드(파일당 6MB, 레슨 전체 8MB 상한). 업로드 데이터는
서버 디스크(`/var/data/local_data/lesson-content.json`)에 저장됨.

## 3. 대용량/원본 전체를 정식 호스팅하려면

- **Cloudflare R2** (render.yaml에 `R2_*` 키가 sync:false로 준비되어 있음) 사용을 권장.
  버킷에 원본을 업로드하고 `R2_PUBLIC_BASE_URL` 기준 링크로 교체하면 110MB 전체를
  git에 넣지 않고 제공 가능. (현재 로컬에 R2 자격증명이 없어 이번 배포엔 미적용.)
- 지금 방식(=`public/` 정적 배치)은 학생 공개용 16MB 핵심 세트만 포함.
