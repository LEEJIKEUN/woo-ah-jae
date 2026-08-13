import { NextRequest, NextResponse } from "next/server";
import { UserLifecycleStatus } from "@prisma/client";
import { requireAdmin, jsonError } from "@/lib/guards";
import { sendFacilitatorApprovalEmail, sendFacilitatorRejectionEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 퍼실리테이터 신청 승인/거절 — 관리자. { action: "approve" | "reject" } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action;
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action 은 approve 또는 reject 여야 합니다." }, { status: 400 });
    }

    const app = await prisma.facilitatorApplication.findUnique({ where: { id } });
    if (!app) return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
    if (app.status !== "PENDING") return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 409 });

    const user = await prisma.user.findUnique({ where: { id: app.userId }, select: { id: true, email: true } });
    const email = user?.email ?? "";

    if (action === "approve") {
      await prisma.$transaction([
        prisma.user.update({ where: { id: app.userId }, data: { lifecycleStatus: UserLifecycleStatus.ACTIVE } }),
        prisma.facilitatorApplication.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: admin.userId } }),
      ]);
      try {
        if (email) await sendFacilitatorApprovalEmail({ to: email, name: app.realName || "선생님" });
      } catch (e) {
        console.error("[facilitator] approval mail failed:", e);
      }
      return NextResponse.json({ ok: true, status: "APPROVED" });
    }

    // reject → 이메일 발송 후 계정·신청 삭제(같은 이메일로 다음에 재지원 가능)
    try {
      if (email) await sendFacilitatorRejectionEmail({ to: email, name: app.realName || "선생님" });
    } catch (e) {
      console.error("[facilitator] rejection mail failed:", e);
    }
    await prisma.$transaction([
      prisma.facilitatorApplication.delete({ where: { id } }),
      prisma.user.delete({ where: { id: app.userId } }),
    ]);
    return NextResponse.json({ ok: true, status: "REJECTED" });
  } catch (error) {
    return jsonError(error);
  }
}
