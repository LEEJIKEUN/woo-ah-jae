import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * 학생(자녀)이 받은 학부모 연결 요청 조회/처리.
 * GET  → 내게 온 PENDING 요청 목록
 * POST → { linkId, action: "approve" | "reject" } 로 수락/거절(본인 것만)
 */
async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const links = await prisma.parentChildLink.findMany({
    where: { childUserId: s.userId, status: "PENDING" },
    select: {
      id: true,
      createdAt: true,
      parent: { select: { email: true, studentProfile: { select: { realName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    requests: links.map((l) => ({
      id: l.id,
      parentName: l.parent.studentProfile?.realName ?? null,
      parentEmail: l.parent.email,
      createdAt: l.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { linkId?: unknown; action?: unknown } | null;
  const linkId = typeof body?.linkId === "string" ? body.linkId : "";
  const action = body?.action;
  if (!linkId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const link = await prisma.parentChildLink.findUnique({
    where: { id: linkId },
    select: { childUserId: true, status: true },
  });
  if (!link || link.childUserId !== s.userId) {
    return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (link.status !== "PENDING") {
    return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 409 });
  }

  await prisma.parentChildLink.update({
    where: { id: linkId },
    data: { status: action === "approve" ? "APPROVED" : "REJECTED", respondedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
