import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAuthFromRequestMock = vi.fn();

const projectFindUniqueMock = vi.fn();
const applicationFindUniqueMock = vi.fn();
const applicationCreateMock = vi.fn();
const applicationCountMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/guards", () => ({
  getAuthFromRequest: getAuthFromRequestMock,
  jsonError: (error: unknown) => {
    const status = typeof error === "object" && error !== null && "status" in error ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
    },
    application: {
      findUnique: applicationFindUniqueMock,
      create: applicationCreateMock,
      count: applicationCountMock,
    },
    projectMember: {
      upsert: vi.fn(),
    },
    $transaction: transactionMock,
  },
}));

describe("project application flow APIs", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthFromRequestMock.mockReset();
    projectFindUniqueMock.mockReset();
    applicationFindUniqueMock.mockReset();
    applicationCreateMock.mockReset();
    applicationCountMock.mockReset();
    transactionMock.mockReset();
  });

  it("returns 403 when non-owner tries to view applications admin endpoint", async () => {
    getAuthFromRequestMock.mockResolvedValue({ userId: "student_a" });
    projectFindUniqueMock.mockResolvedValue({
      id: "p1",
      title: "Project",
      ownerId: "student_owner",
      capacity: 4,
      status: "OPEN",
      question1: "Q1",
      question2: null,
      question3: null,
    });

    const { GET } = await import("@/app/api/me/projects/[id]/applications/route");
    const req = new NextRequest("http://localhost/api/me/projects/p1/applications", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(403);
  });

  it("returns 409 when applicant submits duplicate application", async () => {
    getAuthFromRequestMock.mockResolvedValue({ userId: "applicant_1" });
    projectFindUniqueMock.mockResolvedValue({ id: "p1", status: "OPEN", ownerId: "owner_1" });
    applicationFindUniqueMock.mockResolvedValue({ id: "a1" });

    const { POST } = await import("@/app/api/projects/[id]/apply/route");
    const req = new NextRequest("http://localhost/api/projects/p1/apply", {
      method: "POST",
      body: JSON.stringify({ applicantIntro: "소개 문장", contact: "kakao", answer1: "답변" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(409);
    expect(applicationCreateMock).not.toHaveBeenCalled();
  });

  it("accepting application triggers member upsert and closes project when capacity reached", async () => {
    getAuthFromRequestMock.mockResolvedValue({ userId: "owner_1" });
    projectFindUniqueMock.mockResolvedValue({ id: "p1", ownerId: "owner_1", capacity: 2 });
    applicationFindUniqueMock.mockResolvedValue({ id: "app_1", projectId: "p1", applicantId: "student_2", status: "PENDING" });
    applicationCountMock.mockResolvedValue(1);

    const applicationUpdateMock = vi.fn().mockResolvedValue({ id: "app_1", status: "ACCEPTED" });
    const memberUpsertMock = vi.fn().mockResolvedValue({});
    const txApplicationCountMock = vi.fn().mockResolvedValue(2);
    const projectUpdateMock = vi.fn().mockResolvedValue({ id: "p1", status: "CLOSED" });

    transactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        application: { update: applicationUpdateMock, count: txApplicationCountMock },
        projectMember: { upsert: memberUpsertMock },
        project: { update: projectUpdateMock },
      })
    );

    const { PATCH } = await import("@/app/api/me/projects/[id]/applications/[appId]/route");
    const req = new NextRequest("http://localhost/api/me/projects/p1/applications/app_1", {
      method: "PATCH",
      body: JSON.stringify({ decision: "ACCEPTED" }),
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "p1", appId: "app_1" }) });

    expect(res.status).toBe(200);
    expect(memberUpsertMock).toHaveBeenCalled();
    expect(projectUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CLOSED" }) })
    );
  });
});
