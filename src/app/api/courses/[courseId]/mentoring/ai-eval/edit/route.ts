import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateAiEval } from "@/lib/mentoring/ai-eval-gate";
import { byteLen } from "@/lib/mentoring/bytes";

export const dynamic = "force-dynamic";

const HARD_MAX = 5000; // 방어용 상한(2000바이트 한도는 UI에서 소프트 관리)

/** 관리자 손수정 저장 — 서버에서 byteCount 재계산(클라 값 불신). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const body = (await request.json().catch(() => null)) as { studentId?: unknown; evalText?: unknown } | null;
  const gate = await gateAiEval(request, courseId, body?.studentId);
  if ("error" in gate) return gate.error;

  const evalText = typeof body?.evalText === "string" ? body.evalText.slice(0, HARD_MAX) : "";
  const byteCount = byteLen(evalText);
  const row = await prisma.mentoringAiEval.upsert({
    where: { courseId_studentId: { courseId, studentId: gate.studentId } },
    create: { courseId, studentId: gate.studentId, evalText, aiText: evalText, byteCount, editedBy: gate.userId },
    update: { evalText, byteCount, editedBy: gate.userId },
  });
  return NextResponse.json({ ok: true, byteCount: row.byteCount, editedBy: row.editedBy });
}
