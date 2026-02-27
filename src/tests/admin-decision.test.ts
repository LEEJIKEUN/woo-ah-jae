import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const auditCreateMock = vi.fn();

const prismaMock = {
  verificationSubmission: {
    findUnique: findUniqueMock,
  },
  $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({
      verificationSubmission: { update: updateMock },
      auditLog: { create: auditCreateMock },
    })
  ),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/guards", () => {
  class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireAdmin: vi.fn(),
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
    HttpError,
  };
});

describe("POST /api/admin/verifications/[id]/decision", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    auditCreateMock.mockReset();
    prismaMock.$transaction.mockClear();
  });

  it("returns 403 when caller is not admin", async () => {
    const guards = await import("@/lib/guards");
    vi.mocked(guards.requireAdmin).mockImplementation(async () => {
      throw new guards.HttpError(403, "Admin only");
    });

    const { POST } = await import("@/app/api/admin/verifications/[id]/decision/route");

    const req = new NextRequest("http://localhost/api/admin/verifications/sub_1/decision", {
      method: "POST",
      body: JSON.stringify({ decision: "APPROVE" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "sub_1" }) });
    expect(res.status).toBe(403);
  });

  it("changes status to VERIFIED and writes audit log on approve", async () => {
    const guards = await import("@/lib/guards");
    vi.mocked(guards.requireAdmin).mockResolvedValue({
      userId: "admin_1",
      role: "ADMIN",
      email: "admin@example.com",
    });

    findUniqueMock.mockResolvedValue({
      id: "sub_1",
      userId: "student_1",
      status: "PENDING_REVIEW",
    });

    updateMock.mockResolvedValue({ id: "sub_1", status: "VERIFIED" });
    auditCreateMock.mockResolvedValue({ id: "audit_1" });

    const { POST } = await import("@/app/api/admin/verifications/[id]/decision/route");

    const req = new NextRequest("http://localhost/api/admin/verifications/sub_1/decision", {
      method: "POST",
      body: JSON.stringify({ decision: "APPROVE" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "sub_1" }) });

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "VERIFIED" }) })
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "VERIFICATION_APPROVED",
          targetType: "VerificationSubmission",
          targetId: "sub_1",
        }),
      })
    );
  });
});
