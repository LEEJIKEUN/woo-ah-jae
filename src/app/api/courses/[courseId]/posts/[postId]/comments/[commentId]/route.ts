import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/course/access";
import { deletePrivateKey, storeUploadDataUrl } from "@/lib/private-file";
import { prisma } from "@/lib/prisma";

const MAX_COMMENT_FILE = 10 * 1024 * 1024; // 10MB (작성과 동일)

async function sessionFromReq(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// 댓글 수정 — 작성자 본인만. 본문과 함께 첨부 교체/제거도 지원(작성칸과 동일 기능).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string; commentId: string }> }) {
  const { courseId, postId, commentId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const comment = await prisma.coursePostComment.findFirst({ where: { id: commentId, postId }, select: { authorId: true, fileName: true, fileKey: true } });
  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  if (comment.authorId !== s.userId) return NextResponse.json({ error: "본인이 작성한 댓글만 수정할 수 있습니다." }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as { body?: unknown; file?: unknown; removeFile?: unknown } | null;
  const text = String(typeof raw?.body === "string" ? raw.body : "").trim().slice(0, 5000);
  const removeFile = raw?.removeFile === true;
  const rawFile = raw?.file as { name?: unknown; size?: unknown; mime?: unknown; dataUrl?: unknown } | undefined;
  const hasNewFile = !!rawFile && typeof rawFile.dataUrl === "string" && typeof rawFile.name === "string";
  if (hasNewFile && typeof rawFile!.size === "number" && rawFile!.size > MAX_COMMENT_FILE) {
    return NextResponse.json({ error: "파일이 너무 큽니다. (최대 10MB)" }, { status: 400 });
  }

  // 수정 후 남는 첨부가 있는지: 새 파일 첨부 || (제거 안 했고 기존 첨부가 있었음)
  const willHaveFile = hasNewFile || (!removeFile && !!comment.fileName);
  if (!text && !willHaveFile) return NextResponse.json({ error: "댓글 내용을 입력하세요." }, { status: 400 });

  // 파일 필드 변경분만 계산(변경 없으면 건드리지 않음)
  let fileData: { fileName: string | null; fileMime: string | null; fileSize: number | null; fileKey: string | null; fileData: string | null } | null = null;
  if (hasNewFile) {
    const name = String(rawFile!.name).slice(0, 200);
    const mime = typeof rawFile!.mime === "string" ? rawFile!.mime.slice(0, 120) : "application/octet-stream";
    const size = typeof rawFile!.size === "number" ? rawFile!.size : 0;
    const ref = await storeUploadDataUrl(`board/${courseId}/${postId}`, name, mime, String(rawFile!.dataUrl));
    fileData = { fileName: name, fileMime: mime, fileSize: size, fileKey: ref.key, fileData: ref.data };
  } else if (removeFile) {
    fileData = { fileName: null, fileMime: null, fileSize: null, fileKey: null, fileData: null };
  }

  await prisma.coursePostComment.update({ where: { id: commentId }, data: { body: text, ...(fileData ?? {}) } });

  // 첨부를 교체/제거했다면 기존 R2 오브젝트 정리(best-effort)
  if (fileData && comment.fileKey) await deletePrivateKey(comment.fileKey);

  return NextResponse.json({ ok: true });
}

// 댓글 삭제 — 작성자 본인 또는 스태프. (대댓글은 cascade 로 함께 삭제)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string; postId: string; commentId: string }> }) {
  const { postId, commentId } = await params;
  const s = await sessionFromReq(request);
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const comment = await prisma.coursePostComment.findFirst({ where: { id: commentId, postId }, select: { authorId: true } });
  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  if (comment.authorId !== s.userId && !isStaffRole(s.role)) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }
  await prisma.coursePostComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
