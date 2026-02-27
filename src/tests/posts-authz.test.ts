import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const postCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      create: postCreateMock,
    },
  },
}));

vi.mock("@/lib/guards", () => {
  class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireVerifiedOrAdmin: vi.fn(async () => {
      throw new HttpError(403, "Only VERIFIED students can access this resource");
    }),
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
  };
});

vi.mock("@/lib/entitlement", () => ({
  requireEntitlement: vi.fn(async () => undefined),
}));

describe("POST /api/posts", () => {
  beforeEach(() => {
    postCreateMock.mockReset();
  });

  it("returns 403 when user is not VERIFIED", async () => {
    const { POST } = await import("@/app/api/posts/route");

    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ scope: "GLOBAL", title: "t", body: "b" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(postCreateMock).not.toHaveBeenCalled();
  });
});
