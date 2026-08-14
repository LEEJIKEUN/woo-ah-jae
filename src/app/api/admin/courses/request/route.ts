import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/guards";
import { sendCourseRequestEmail } from "@/lib/mailer";
import { createNotifications } from "@/lib/notification-store";

export const dynamic = "force-dynamic";

type ReqLesson = { title?: unknown; kind?: unknown; body?: unknown };
type ReqModule = { label?: unknown; lessons?: unknown };
type ReqBody = {
  title?: unknown;
  subtitle?: unknown;
  objectives?: unknown;
  programme?: unknown;
  audience?: unknown;
  format?: unknown;
  deliveryMode?: unknown;
  periodLabel?: unknown;
  country?: unknown;
  summary?: unknown;
  modules?: unknown;
};

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 사람이 읽을 수 있는 강좌 사양 텍스트로 변환(이메일·화면 공용). */
function buildSpec(b: ReqBody): string {
  const objectives = s(b.objectives)
    .split("\n")
    .map((x) => x.replace(/^\s*\d+\s*[.)]\s*/, "").trim())
    .filter(Boolean);
  const lines: string[] = [
    "[강좌 개설 요청]",
    `강좌명: ${s(b.title)}`,
    `부제: ${s(b.subtitle) || "-"}`,
    `상단 라벨: ${s(b.programme) || "-"}`,
    `대상: ${s(b.audience) || "-"}`,
    `형식: ${s(b.format) || "-"}`,
    `방식: ${s(b.deliveryMode) || "-"}`,
    `기간: ${s(b.periodLabel) || "-"}`,
    `국가: ${s(b.country) || "-"}`,
    "",
    "세부 목표:",
    ...(objectives.length ? objectives.map((o, i) => `  ${i + 1}. ${o}`) : ["  -"]),
    "",
    "강좌 설명:",
    s(b.summary) ? `  ${s(b.summary).replace(/\n/g, "\n  ")}` : "  -",
    "",
    "커리큘럼:",
  ];
  const modules = Array.isArray(b.modules) ? (b.modules as ReqModule[]) : [];
  if (!modules.length) {
    lines.push("  -");
  } else {
    modules.forEach((m, mi) => {
      lines.push(`  [모듈 ${mi + 1}] ${s(m.label) || "(제목 없음)"}`);
      const lessons = Array.isArray(m.lessons) ? (m.lessons as ReqLesson[]) : [];
      lessons.forEach((l) => {
        const kind = s(l.kind) === "assignment" ? "과제" : "강의";
        lines.push(`    - (${kind}) ${s(l.title) || "(제목 없음)"}`);
      });
    });
  }
  return lines.join("\n");
}

/**
 * 새 강좌 개설 "요청" 접수 — 관리자 전용.
 * 우아재는 강좌 구조를 하드코딩(content.ts)으로 관리하므로, 여기서는 DB 강좌를 만들지 않고
 * 강좌 사양을 정리해 요청자에게 메일·알림으로 전달한다(담당자가 구성 후 공개).
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as ReqBody | null;
    const title = s(body?.title);
    if (!body || !title) {
      return NextResponse.json({ error: "강좌명을 입력해 주세요." }, { status: 400 });
    }
    const spec = buildSpec(body);

    // 요청자 본인 메일로 사양 전달(내역 보존). best-effort — 메일 실패해도 요청은 접수.
    if (admin.email) {
      try {
        await sendCourseRequestEmail({ to: admin.email, requesterEmail: admin.email, title, spec });
      } catch {
        /* 메일 실패 무시 */
      }
    }
    // 요청자 계정 알림(벨)에도 접수 표시. best-effort.
    try {
      await createNotifications([{ userId: admin.userId, kind: "notice", title: `새 강좌 개설 요청 접수 · ${title}`, body: spec, href: "/" }]);
    } catch {
      /* 알림 실패 무시 */
    }

    return NextResponse.json({ ok: true, spec });
  } catch (error) {
    return jsonError(error);
  }
}
