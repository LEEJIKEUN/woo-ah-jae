# Render 배포 오픈 체크리스트 (Woo Ah Jae)

이 문서는 `wooahjae.com` 오픈 직전/직후 점검을 위한 최종 체크리스트입니다.

## 1) 코드 배포

```bash
git add .
git commit -m "chore: render production open prep"
git push origin <branch>
```

## 2) Render Blueprint 생성

- Render 대시보드 -> `New +` -> `Blueprint`
- 저장소 선택
- `render.yaml` 인식 확인 후 `Apply`
- 서비스 이름: `woo-ah-jae`

## 3) 필수 환경변수 (Render Web Service)

아래 값이 모두 설정되어야 오픈 가능합니다.

- `NODE_ENV=production`
- `DATABASE_URL=file:/var/data/dev.db`
- `PRIVATE_UPLOAD_DIR=/var/data/private_uploads`
- `APP_URL=https://wooahjae.com`
- `NEXT_PUBLIC_APP_URL=https://wooahjae.com`
- `JWT_SECRET=<충분히 긴 랜덤 문자열>`
- `RESEND_API_KEY=<Resend 실제 키>`
- `MAIL_FROM=Woo Ah Jae <no-reply@wooahjae.com>`

권장(관리 계정 시드):
- `SEED_ADMIN_EMAIL=admin@wooahjae.com`
- `SEED_ADMIN_PASSWORD=<강한 비밀번호>`

## 4) Persistent Disk

`render.yaml` 기준:
- mount path: `/var/data`
- size: `5GB`

확인 항목:
- 서비스 상세에서 디스크가 attach 상태인지 확인

## 5) 첫 배포 후 1회 초기화

Render Shell 실행 후:

```bash
node prisma/seed.mjs
```

## 6) 도메인 연결

- Service -> Settings -> Custom Domains -> `wooahjae.com` 추가
- Render가 제시한 DNS 레코드를 도메인 DNS에 반영
- SSL 발급 완료까지 대기

## 7) 오픈 스모크 테스트

아래 항목 모두 통과 시 오픈 가능:

1. `https://wooahjae.com/login` 접속 가능
2. 관리자 로그인 가능
3. 학생 로그인 가능
4. `https://wooahjae.com/forgot-password`에서 메일 발송 성공
5. 수신된 링크가 `https://wooahjae.com/reset-password?...` 형식
6. 비밀번호 재설정 후 로그인 성공
7. 워크스페이스 입장/실시간 채팅 가능

## 8) 베타 30명 운영 권장

- 동시 접속/채팅을 고려해 Render `Starter` 이상 유지
- 첫 주는 에러 로그 모니터링(배포 로그 + 앱 로그)
- DB 백업 정책(주 1회 이상) 수동 점검
