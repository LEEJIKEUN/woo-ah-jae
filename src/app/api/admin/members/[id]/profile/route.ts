import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/guards";
import { getCourse } from "@/lib/course/content";
import { loadDbCourse } from "@/lib/course/db-course";
import { createNotifications } from "@/lib/notification-store";
import { sendFacilitatorCourseAssignedEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

async function courseTitleOf(courseId: string): Promise<string> {
  const hard = getCourse(courseId);
  if (hard) return hard.title;
  const db = await loadDbCourse(courseId);
  return db?.title ?? courseId;
}

const ROLE_KO: Record<string, string> = { ADMIN: "관리자", FACILITATOR: "퍼실리테이터", PARENT: "학부모", STUDENT: "학생" };
const ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FACILITATOR, UserRole.PARENT, UserRole.ADMIN];

function trimOrNull(v: unknown) {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : null;
}

/** 관리자: 회원 프로필 조회 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const u = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, createdAt: true,
        studentProfile: { select: { realName: true, schoolName: true, grade: true, residenceCountry: true, birthDate: true } },
      },
    });
    if (!u) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    const assigned = await prisma.facilitatorCourse.findMany({ where: { facilitatorUserId: id }, select: { courseId: true } });
    const p = u.studentProfile;
    return NextResponse.json({
      id: u.id,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_KO[u.role] ?? u.role,
      createdAt: u.createdAt.toISOString(),
      realName: p?.realName ?? "",
      schoolName: p?.schoolName ?? "",
      grade: p?.grade ?? "",
      residenceCountry: p?.residenceCountry ?? "",
      birthDate: p?.birthDate ? p.birthDate.toISOString().slice(0, 10) : "",
      assignedCourseIds: assigned.map((a) => a.courseId),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** 관리자: 회원 프로필·권한·담당강좌 수정 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!u) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    // 권한 변경(관리자만 · 본인 권한은 변경 불가)
    let finalRole: UserRole = u.role;
    if (typeof body?.role === "string" && ROLES.includes(body.role as UserRole) && body.role !== u.role) {
      if (id === admin.userId) return NextResponse.json({ error: "본인 권한은 변경할 수 없습니다. (재가입 필요)" }, { status: 400 });
      finalRole = body.role as UserRole;
    }

    const realName = trimOrNull(body?.realName);
    if (realName === null) return NextResponse.json({ error: "이름(실명)은 비울 수 없습니다." }, { status: 400 });

    const birthRaw = typeof body?.birthDate === "string" ? body.birthDate.trim() : "";
    const birthDate = birthRaw ? new Date(birthRaw) : null;
    if (birthRaw && Number.isNaN(birthDate!.getTime())) return NextResponse.json({ error: "생년월일 형식이 올바르지 않습니다." }, { status: 400 });

    const profileData = {
      realName: realName ?? undefined,
      schoolName: trimOrNull(body?.schoolName),
      grade: trimOrNull(body?.grade),
      residenceCountry: trimOrNull(body?.residenceCountry),
      birthDate,
    };

    // 배정 전 담당 강좌(신규 배정 감지용)
    const before = await prisma.facilitatorCourse.findMany({ where: { facilitatorUserId: id }, select: { courseId: true } });
    const beforeSet = new Set(before.map((b) => b.courseId));

    let newCourseIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      if (finalRole !== u.role) await tx.user.update({ where: { id }, data: { role: finalRole } });
      await tx.studentProfile.upsert({
        where: { userId: id },
        create: { userId: id, realName: realName ?? "", schoolName: profileData.schoolName, grade: profileData.grade, residenceCountry: profileData.residenceCountry, birthDate },
        update: profileData,
      });
      // 담당 강좌 — 퍼실리테이터일 때만 유지, 아니면 비움
      await tx.facilitatorCourse.deleteMany({ where: { facilitatorUserId: id } });
      if (finalRole === UserRole.FACILITATOR && Array.isArray(body?.courseIds)) {
        const courseIds = [...new Set((body!.courseIds as unknown[]).filter((c): c is string => typeof c === "string"))];
        for (const courseId of courseIds) await tx.facilitatorCourse.create({ data: { facilitatorUserId: id, courseId } });
        newCourseIds = courseIds.filter((c) => !beforeSet.has(c));
      }
    });

    // 신규 배정 → 퍼실리테이터에게 이메일 + 앱 알림(best-effort)
    if (newCourseIds.length) {
      const fac = await prisma.user.findUnique({ where: { id }, select: { email: true, studentProfile: { select: { realName: true } } } });
      const name = fac?.studentProfile?.realName || "선생님";
      for (const courseId of newCourseIds) {
        const title = await courseTitleOf(courseId);
        await createNotifications([{ userId: id, kind: "notice", title: "담당 강좌가 배정되었어요", body: `${title} 강좌의 담당 퍼실리테이터로 배정되었습니다.`, href: `/course/${courseId}` }]);
        try {
          if (fac?.email) await sendFacilitatorCourseAssignedEmail({ to: fac.email, name, courseTitle: title });
        } catch (e) {
          console.error("[facilitator] course-assigned mail failed:", e);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
