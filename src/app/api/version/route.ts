import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 배포 확인용 — Render 가 런타임에 주입하는 커밋 SHA(RENDER_GIT_COMMIT)와 프로세스 가동 시간.
 * 인증 불필요(비밀 정보 없음). 푸시 후 이 값이 새 커밋으로 바뀌면 배포 완료.
 */
export async function GET() {
  return NextResponse.json(
    {
      commit: process.env.RENDER_GIT_COMMIT ?? null,
      branch: process.env.RENDER_GIT_BRANCH ?? null,
      uptimeSec: Math.round(process.uptime()),
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
