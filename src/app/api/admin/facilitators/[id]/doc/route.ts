import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { readPrivateFile } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** 퍼실리테이터 신청 증빙서류 — 관리자 열람. 기본 inline, ?download=1 첨부. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const app = await prisma.facilitatorApplication.findUnique({ where: { id }, select: { fileKey: true, fileName: true, fileMime: true } });
    if (!app || !app.fileKey) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });

    const buffer = await readPrivateFile(app.fileKey);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const encoded = encodeURIComponent(app.fileName || "document");
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": app.fileMime || "application/octet-stream",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
