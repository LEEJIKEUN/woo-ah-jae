import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCourse } from "@/lib/course/content";
import { canEnterClassroom } from "@/lib/course/access";
import { readUpload } from "@/lib/private-file";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/** 댓글 첨부파일 — 강의실 접근 가능한 사용자. 기본 inline, ?download=1 첨부. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string; commentId: string }> }) {
  const { courseId, postId, commentId } = await params;
  if (!getCourse(courseId)) return new NextResponse("Not found", { status: 404 });
  const s = await sessionFromReq(request);
  if (!s) return new NextResponse("Unauthorized", { status: 401 });
  if (!(await canEnterClassroom(courseId, s))) return new NextResponse("Forbidden", { status: 403 });

  const c = await prisma.coursePostComment.findFirst({
    where: { id: commentId, postId, post: { courseId } },
    select: { fileName: true, fileMime: true, fileKey: true, fileData: true },
  });
  if (!c || !c.fileName || (!c.fileKey && !c.fileData)) return new NextResponse("Not found", { status: 404 });

  const buf = await readUpload({ key: c.fileKey, data: c.fileData });
  if (!buf) return new NextResponse("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const encoded = encodeURIComponent(c.fileName);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": c.fileMime || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}
