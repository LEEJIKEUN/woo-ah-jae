# Woo Ah Jae 운영 전환 가이드 (Render + 외부 Postgres + R2)

이 문서는 “데이터 자산 최우선(이전 쉬움)” 운영 구성을 단계별로 안내합니다.

## 목표 구조

- 앱 서버: Render Web Service
- DB: 외부 Postgres (Neon/Supabase/Render Postgres 중 택1)
- 파일: Cloudflare R2

---

## 0) 사전 원칙

- 운영 환경에서 파괴성 스크립트는 잠금 유지
  - `ALLOW_DESTRUCTIVE_ADMIN_SCRIPT=false`
  - `ALLOW_MEMBER_WITHDRAW_IN_PROD=false`
- 슈퍼 관리자 고정
  - `SUPER_ADMIN_EMAIL=admin@wooahjae.local`

---

## 1) Cloudflare R2 준비 (사용자 작업)

1. Cloudflare R2에서 버킷 2개 생성
   - public: `wooahjae-public`
   - private: `wooahjae-private`
2. API Token 생성 (R2 write/read)
3. Public 파일용 도메인 연결 (예: `cdn.wooahjae.com`)
4. Render 환경변수에 아래 설정
   - `STORAGE_BACKEND=r2`
   - `R2_ACCOUNT_ID=...`
   - `R2_ACCESS_KEY_ID=...`
   - `R2_SECRET_ACCESS_KEY=...`
   - `R2_BUCKET_PUBLIC=wooahjae-public`
   - `R2_BUCKET_PRIVATE=wooahjae-private`
   - `R2_PUBLIC_BASE_URL=https://cdn.wooahjae.com`

---

## 2) 외부 Postgres 준비 (사용자 작업)

권장: Neon (사용량 기반, 시작 빠름)

1. Neon 프로젝트 생성
2. DB 생성 후 connection string 확보
3. Render 환경변수 `DATABASE_URL`에 입력
   - 예: `postgresql://...`

현재 코드베이스는 Prisma datasource가 PostgreSQL로 설정되어 있습니다.
운영에서는 Neon 연결 문자열(`DATABASE_URL`, `DATABASE_URL_UNPOOLED`)만 Render에 설정하면 됩니다.

---

## 3) Render 운영 환경변수 권장값

- `NODE_ENV=production`
- `APP_URL=https://wooahjae.com`
- `NEXT_PUBLIC_APP_URL=https://wooahjae.com`
- `JWT_SECRET=<충분히 긴 랜덤 문자열>`
- `SUPER_ADMIN_EMAIL=admin@wooahjae.local`
- `ALLOW_DESTRUCTIVE_ADMIN_SCRIPT=false`
- `ALLOW_MEMBER_WITHDRAW_IN_PROD=false`
- `ALLOW_DEMO_SEED_IN_PROD=false`
- `DB_BACKUP_DIR=/var/data/backups` (SQLite 운영 시)
- `DB_BACKUP_KEEP_COUNT=30`

메일:
- `RESEND_API_KEY=...`
- `MAIL_FROM=Woo Ah Jae <no-reply@wooahjae.com>`

---

## 4) 운영 데이터 보호 체크리스트

- [ ] 운영에서 `/api/admin/prepare-beta-content` 403 확인
- [ ] 운영에서 회원 강제 탈퇴(파괴 API) 잠금 확인
- [ ] DB 백업 파일이 생성되는지 확인 (SQLite 운영 시)
- [ ] 관리자 계정으로만 민감 작업 가능 확인

---

## 5) 다음 단계 (DB 전환 실제 진행)

Postgres 전환은 아래 순서로 진행합니다.

1. Prisma datasource를 Postgres로 전환
2. 초기 마이그레이션 생성
3. 기존 SQLite 데이터 이관 스크립트 실행
4. 스테이징에서 검증
5. 운영 컷오버(읽기 전용 창구/점검 공지 후)

원하면 다음 턴에서 5단계를 실제 코드/스크립트까지 바로 진행합니다.
