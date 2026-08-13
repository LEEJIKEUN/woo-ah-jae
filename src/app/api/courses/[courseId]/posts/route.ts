import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom, isStaffRole } from "@/lib/course/access";
import { isUserEnrolled, getEnrolledUserIds } from "@/lib/enrollment-store";
import { createNotifications, notifyCourseStaff, notifyMentions } from "@/lib/notification-store";
import { prisma } from "@/lib/prisma";

/**
 * 강의실 게시글 목록/작성.
 * - 조회: 강의실 접근 가능한 사용자(스태프·수강생·자녀수강 학부모)
 * - 작성: 공지(NOTICE)=관리자·퍼실리테이터 / 토론(DISCUSSION)=스태프 or 수강 학생
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

function parseKind(v: string | null): "NOTICE" | "DISCUSSION" {
  return v === "NOTICE" ? "NOTICE" : "DISCUSSION";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  const kind = parseKind(new URL(request.url).searchParams.get("kind"));
  const posts = await prisma.coursePost.findMany({
    where: { courseId, kind },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      viewCount: true,
      createdAt: true,
      authorId: true,
      author: { select: { role: true, studentProfile: { select: { realName: true } } } },
      _count: { select: { comments: true, likes: true } },
      likes: { where: { userId: s.userId }, select: { userId: true } },
    },
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      pinned: p.pinned,
      createdAt: p.createdAt,
      authorId: p.authorId,
      authorName: p.author.studentProfile?.realName ?? "사용자",
      authorRole: p.author.role,
      commentCount: p._count.comments,
      likeCount: p._count.likes,
      likedByMe: p.likes.length > 0,
      viewCount: p.viewCount,
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!getCourse(courseId)) return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const raw = (await request.json().catch(() => null)) as { kind?: unknown; title?: unknown; body?: unknown } | null;
  const kind = parseKind(typeof raw?.kind === "string" ? raw.kind : null);

  const staff = isStaffRole(s.role);
  const enrolledStudent = !staff && s.role === "STUDENT" && (await isUserEnrolled(courseId, s.userId));
  const canWrite = kind === "NOTICE" ? staff : staff || enrolledStudent;
  if (!canWrite) {
    return NextResponse.json({ error: kind === "NOTICE" ? "공지사항은 관리자·퍼실리테이터만 작성할 수 있습니다." : "글쓰기 권한이 없습니다." }, { status: 403 });
  }

  const title = String(typeof raw?.title === "string" ? raw.title : "").trim().slice(0, 200);
  const body = String(typeof raw?.body === "string" ? raw.body : "").trim().slice(0, 20000);
  if (!title) return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 });

  const post = await prisma.coursePost.create({ data: { courseId, kind, authorId: s.userId, title, body } });

  // 스태프(관리자·퍼실)가 올린 공지/글 → 수강생 알림 / 학생이 올린 토론글 → 스태프 알림
  if (staff) {
    const ids = await getEnrolledUserIds(courseId);
    const label = kind === "NOTICE" ? "새 공지" : "새 글";
    const href = kind === "NOTICE" ? `/course/${courseId}/notices` : `/course/${courseId}/board`;
    await createNotifications(
      ids.filter((id) => id !== s.userId).map((uid) => ({ userId: uid, kind: kind === "NOTICE" ? "notice" : "post", title: `${label} · ${title}`, body, href }))
    );
  } else {
    await notifyCourseStaff(courseId, s.userId, { kind: "post", title: `새 토론글 · ${title}`, body, href: `/course/${courseId}/board` });
  }
  // @이름 멘션 → 해당 학생(+학부모) 알림
  const href = kind === "NOTICE" ? `/course/${courseId}/notices` : `/course/${courseId}/board`;
  await notifyMentions(courseId, `${title}\n${body}`, { actorUserId: s.userId, href, context: kind === "NOTICE" ? "공지" : "토론글" });

  return NextResponse.json({ ok: true, id: post.id }, { status: 201 });
}
