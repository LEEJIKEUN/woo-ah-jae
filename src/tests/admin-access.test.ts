import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/guards", () => {
  class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireAdmin: vi.fn(async () => {
      throw new HttpError(403, "Admin only");
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationSubmission: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/admin/verifications", () => {
  it("returns 403 for non-admin (including PENDING students)", async () => {
    const { GET } = await import("@/app/api/admin/verifications/route");

    const req = new NextRequest("http://localhost/api/admin/verifications", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
