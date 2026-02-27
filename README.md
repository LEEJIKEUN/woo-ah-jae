# Woo Ah Jae (MVP)

재외 한국 학생 프로젝트 협업 커뮤니티 MVP.

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind
- SQLite + Prisma
- 인증: 이메일/비밀번호 + JWT 세션 쿠키
- 파일 업로드: 비공개 로컬 저장소(`.private_uploads`)
- 테스트: Vitest

## 구현된 핵심 기능

- 학생 회원가입/로그인 API
- 학생 인증 제출 API + 상태 조회 API
  - 상태 머신: `NOT_SUBMITTED -> PENDING_REVIEW -> VERIFIED | REJECTED`
- 관리자 인증 승인 큐 API
  - 승인/거절 처리 + `AuditLog` 기록
  - 관리자 전용 파일 열람 API(비공개 파일만)
- 권한 가드
  - ADMIN 전용 라우트
  - VERIFIED 전용 글쓰기/프로젝트/그룹 관련 쓰기 액션
- 공지 CRUD API(관리자)
- 프로젝트/그룹/게시글/댓글 MVP API
  - 그룹 비밀번호 해시 저장(`joinSecretHash`)
- 프로젝트 생성/지원/선발 MVP
  - `/projects/new` 생성
  - `/projects/[id]` 상세 + 지원 상태 표시
  - `/projects/[id]/apply` 지원서 제출
  - `/me/projects` 내 프로젝트 관리
  - `/me/projects/[id]/applications` 지원자 수락/거절 + 정원 마감 처리
- 유료화 대비 구조
  - `FeatureFlag.billingEnabled=false` 기본
  - `Plan`, `Entitlement` 스키마 + `requireEntitlement` 미들웨어 틀

## 로컬 실행

1. 환경 변수 복사
```bash
cp .env.example .env
```

썸네일 자동 생성(선택):
```bash
# Unsplash 개발자 키
UNSPLASH_ACCESS_KEY=...
```

비밀번호 재설정 메일 발송(Resend):
```bash
RESEND_API_KEY=...
MAIL_FROM="Woo Ah Jae <no-reply@yourdomain.com>"
```

2. SQLite 스키마 생성
```bash
npm run db:migrate
```

3. Prisma Client 생성
```bash
npm run db:generate
```

4. 시드 실행(ADMIN + 테스트 학생 2명 + FeatureFlag + FREE Plan)
```bash
npm run db:seed
```

5. 개발 서버
```bash
npm run dev
```

### 테스트 계정
- 관리자: `admin@wooahjae.local` / `ChangeMe123!`
- 대표 학생(프로젝트 생성): `student.owner@wooahjae.local` / `Student123!`
- 지원 학생(지원서 제출): `student.applicant@wooahjae.local` / `Student123!`

## 테스트

```bash
npm run lint
npm run test
npm run build
```

## 프로젝트 썸네일 자동 생성 (MVP)

- 생성 시점: `POST /api/projects`
- 동작:
  1. `tab/channel/title/description` 기반 키워드 생성
  2. Unsplash 검색 API에서 썸네일 1장 조회
  3. `Project.thumbnailUrl`에 저장
- 캐시:
  - 서버 메모리 캐시(`projectId`, `keyword`)로 중복 호출 방지
- 실패 시:
  - API 키 없음/호출 실패 시 `thumbnailUrl`은 `null` 유지
  - UI는 기존 그라데이션 fallback 렌더링

필수 권한/상태 전이 테스트 포함:
- VERIFIED가 아니면 글쓰기 API 403
- 비관리자(PENDING 포함)는 관리자 인증 API 접근 403
- ADMIN만 승인/거절 가능
- 승인 시 `status=VERIFIED` 업데이트 + audit log 생성

## 스크립트

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run db:up`
- `npm run db:down`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`

## 주의사항
- 현재 MVP는 로컬 SQLite(`prisma/dev.db`)를 사용합니다.
- 썸네일 업로드는 `public/uploads/projects`에 저장됩니다.
- 민감 파일 업로드(학생증 등)와 분리되어 있으며, 추후 S3/Supabase Storage로 교체 가능하도록 `lib/storage.ts`로 분리했습니다.

## 실서비스 배포(30명 베타 권장: 단일 인스턴스 + SQLite Persistent Disk)

`wooahjae.com` 도메인을 실제 웹앱에 연결하려면 앱을 호스팅 플랫폼에 배포해야 합니다.

권장 구성(예: Render/Fly.io/Railway 단일 인스턴스):
- Build: `npm ci && npm run db:generate && npm run build`
- Start: `npm run db:migrate && npm run start`
- 환경변수:
  - `NODE_ENV=production`
  - `DATABASE_URL=file:./dev.db` (플랫폼의 persistent disk 경로에 맞게 설정)
  - `JWT_SECRET=<강한 랜덤 문자열>`
  - `APP_URL=https://wooahjae.com`
  - `NEXT_PUBLIC_APP_URL=https://wooahjae.com`
  - `RESEND_API_KEY=<Resend API Key>`
  - `MAIL_FROM="Woo Ah Jae <no-reply@wooahjae.com>"`

중요:
- 이 프로젝트는 Socket.IO(실시간 채팅)를 사용하므로, 서버리스 플랫폼에서는 제약이 생길 수 있습니다.
- 단일 인스턴스(Node 서버 유지) 배포를 권장합니다.

### Render 1:1 배포 순서 (wooahjae.com 연결)

1. GitHub에 현재 코드 푸시 (루트에 `render.yaml`, `Dockerfile` 포함)
2. Render 대시보드에서 `New +` -> `Blueprint` 선택
3. 저장소 연결 후 `render.yaml` 인식되면 `Apply`로 서비스 생성
4. 생성된 `woo-ah-jae` 서비스 `Environment`에서 아래 값 입력
   - `APP_URL=https://wooahjae.com`
   - `NEXT_PUBLIC_APP_URL=https://wooahjae.com`
   - `JWT_SECRET=<강한 랜덤 문자열>`
   - `RESEND_API_KEY=<Resend API Key>`
   - `MAIL_FROM=\"Woo Ah Jae <no-reply@wooahjae.com>\"`
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (원하는 관리자 계정)
5. 첫 배포 완료 후 Render Shell에서 1회 실행
   - `node prisma/seed.mjs`
6. Render 서비스 `Settings` -> `Custom Domains`에 `wooahjae.com` 추가
7. 도메인 DNS에서 Render가 안내한 `A/CNAME` 값 반영
8. HTTPS 인증 완료 후 접속 확인
   - `https://wooahjae.com/login`
9. 비밀번호 찾기 최종 점검
   - `https://wooahjae.com/forgot-password` 요청 -> 메일 수신 -> 링크 클릭 -> 재설정

## 구독 결제 연동 대비 (사전 구축)

- 관리자 회원관리 페이지(`/admin/members`)에 회원/플랜/구독상태 표시
- 10초 자동 폴링으로 상태 반영(실시간 유사)
- 결제 연동용 웹훅 준비: `POST /api/billing/events`
  - 헤더 `x-billing-secret` (선택, `BILLING_WEBHOOK_SECRET` 설정 시 필수)
  - 예시 payload:
```json
{
  "eventType": "SUBSCRIPTION_UPDATED",
  "userEmail": "student@example.com",
  "planCode": "PRO",
  "status": "ACTIVE",
  "startAt": "2026-02-24T00:00:00.000Z",
  "endAt": "2026-03-24T00:00:00.000Z"
}
```

현재 기본 운영은 무료(`billingEnabled=false`)이며, 결제 미연동 상태입니다.
