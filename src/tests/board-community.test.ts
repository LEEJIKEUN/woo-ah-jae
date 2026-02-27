import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAuthFromRequestMock = vi.fn();
const getOptionalAuthFromRequestMock = vi.fn();

const boardChannelFindUniqueMock = vi.fn();
const boardPostCreateMock = vi.fn();
const boardPostFindUniqueMock = vi.fn();
const boardPostLikeFindUniqueMock = vi.fn();
const boardPostLikeDeleteMock = vi.fn();
const boardPostLikeCreateMock = vi.fn();
const boardPostUpdateMock = vi.fn();
const transactionMock = vi.fn();
const boardCommentFindUniqueMock = vi.fn();

vi.mock("@/lib/guards", () => ({
  getAuthFromRequest: getAuthFromRequestMock,
  jsonError: (error: unknown) => {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  },
}));

vi.mock("@/lib/board-auth", () => ({
  getOptionalAuthFromRequest: getOptionalAuthFromRequestMock,
  getViewerIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    boardChannel: {
      findUnique: boardChannelFindUniqueMock,
    },
    boardPost: {
      create: boardPostCreateMock,
      findUnique: boardPostFindUniqueMock,
      update: boardPostUpdateMock,
    },
    boardPostLike: {
      findUnique: boardPostLikeFindUniqueMock,
      delete: boardPostLikeDeleteMock,
      create: boardPostLikeCreateMock,
    },
    boardComment: {
      findUnique: boardCommentFindUniqueMock,
    },
    $transaction: transactionMock,
  },
}));

describe("board community APIs", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthFromRequestMock.mockReset();
    getOptionalAuthFromRequestMock.mockReset();
    boardChannelFindUniqueMock.mockReset();
    boardPostCreateMock.mockReset();
    boardPostFindUniqueMock.mockReset();
    boardPostLikeFindUniqueMock.mockReset();
    boardPostLikeDeleteMock.mockReset();
    boardPostLikeCreateMock.mockReset();
    boardPostUpdateMock.mockReset();
    boardCommentFindUniqueMock.mockReset();
    transactionMock.mockReset();
  });

  it("returns 400 when attachments exceed file limits on post create", async () => {
    getAuthFromRequestMock.mockResolvedValue({ userId: "u1", role: "STUDENT" });
    getOptionalAuthFromRequestMock.mockResolvedValue({ userId: "u1", role: "STUDENT" });
    boardChannelFindUniqueMock.mockResolvedValue({ id: "ch1" });

    const { POST } = await import("@/app/api/boards/[slug]/posts/route");
    const req = new NextRequest("http://localhost/api/boards/study-admission/posts", {
      method: "POST",
      body: JSON.stringify({
        title: "게시글 제목",
        content: "게시글 본문",
        attachments: [
          { url: "/a", name: "a.pdf", mimeType: "application/pdf", size: 1000 },
          { url: "/b", name: "b.pdf", mimeType: "application/pdf", size: 1000 },
          { url: "/c", name: "c.pdf", mimeType: "application/pdf", size: 1000 },
          { url: "/d", name: "d.pdf", mimeType: "application/pdf", size: 1000 },
        ],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "study-admission" }) });
    expect(res.status).toBe(400);
    expect(boardPostCreateMock).not.toHaveBeenCalled();
  });

  it("toggles like off when user already liked the post", async () => {
    getAuthFromRequestMock.mockResolvedValue({ userId: "u1", role: "STUDENT" });
    boardPostFindUniqueMock.mockResolvedValue({ id: "p1", status: "ACTIVE" });
    boardPostLikeFindUniqueMock.mockResolvedValue({ id: "like1" });

    const txBoardPostUpdateMock = vi.fn().mockResolvedValue({ likeCount: 9 });
    const txBoardPostLikeDeleteMock = vi.fn().mockResolvedValue({});
    transactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        boardPost: { update: txBoardPostUpdateMock },
        boardPostLike: { delete: txBoardPostLikeDeleteMock },
      })
    );

    const { POST } = await import("@/app/api/board-posts/[id]/like/route");
    const req = new NextRequest("http://localhost/api/board-posts/p1/like", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "p1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ liked: false, likeCount: 9 });
  });

  it("returns 403 when non-owner tries to delete a comment", async () => {
    getAuthFromRequestMock.mockResolvedValue({ userId: "u1", role: "STUDENT" });
    boardCommentFindUniqueMock.mockResolvedValue({
      id: "c1",
      authorId: "author_2",
      postId: "p1",
      status: "ACTIVE",
    });

    const { DELETE } = await import("@/app/api/board-comments/[id]/route");
    const req = new NextRequest("http://localhost/api/board-comments/c1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "c1" }) });

    expect(res.status).toBe(403);
  });
});
