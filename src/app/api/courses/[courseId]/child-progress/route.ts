import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { completableActivityIds } from "@/lib/course/content";
import { getEffectiveCourse } from "@/lib/course/curriculum";
import { isUserEnrolled } from "@/lib/enrollment-store";
import { percentDone } from "@/lib/course/progress";
import { prisma } from "@/lib/prisma";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// 학부모가 보는 '연결된 자녀' 진도율(자녀 로그인 화면과 동일 계산). 자녀 여럿이면 첫 자녀.
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await getEffectiveCourse(courseId);
  if (!course) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (s.role !== "PARENT") return NextResponse.json({ error: "학부모만 조회할 수 있습니다." }, { status: 403 });

  const links = await prisma.parentChildLink.findMany({
    where: { parentUserId: s.userId, status: "APPROVED" },
    select: { childUserId: true, child: { select: { email: true, studentProfile: { select: { realName: true } } } } },
  });
  let child: { id: string; name: string } | null = null;
  for (const l of links) {
    if (await isUserEnrolled(courseId, l.childUserId)) {
      child = { id: l.childUserId, name: l.child.studentProfile?.realName || l.child.email };
      break;
    }
  }
  if (!child) return NextResponse.json({ percent: null, childName: null });

  const completable = completableActivityIds(course);
  const rows = await prisma.lessonCompletion.findMany({
    where: { userId: child.id, courseId },
    select: { activityId: true },
  });
  const doneSet = new Set(rows.map((r) => r.activityId));
  const done = completable.filter((id) => doneSet.has(id)).length;
  return NextResponse.json({ percent: percentDone(done, completable.length), childName: child.name });
}
