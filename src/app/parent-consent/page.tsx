import { prisma } from "@/lib/prisma";
import ConsentForm from "./ConsentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "보호자 연결 동의 · 우아재" };

const INK = "#2C2823";
const SUB = "#8A8479";
const serif = { fontFamily: "var(--font-serif)" } as const;

export default async function ParentConsentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const link = token
    ? await prisma.parentChildLink.findUnique({
        where: { consentToken: token },
        select: {
          status: true,
          parent: { select: { email: true, studentProfile: { select: { realName: true } } } },
          child: { select: { studentProfile: { select: { realName: true } } } },
        },
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-16 md:py-20">
      <h1 className="mb-6 text-[26px] font-semibold" style={{ ...serif, color: INK }}>보호자 연결 동의</h1>

      {!token || !link ? (
        <div className="rounded-[12px] border p-6 text-center" style={{ borderColor: "#E4DBC7" }}>
          <p className="text-[15px]" style={{ color: SUB }}>유효하지 않거나 만료된 링크입니다.</p>
        </div>
      ) : link.status !== "PENDING" ? (
        <div className="rounded-[12px] border p-6 text-center" style={{ borderColor: "#E4DBC7" }}>
          <p className="text-[15px]" style={{ color: SUB }}>
            이미 {link.status === "APPROVED" ? "동의" : "거절"} 처리된 요청입니다.
          </p>
        </div>
      ) : (
        <ConsentForm
          token={token}
          parentName={link.parent.studentProfile?.realName ?? "학부모"}
          parentEmail={link.parent.email}
          childName={link.child.studentProfile?.realName ?? "학생"}
        />
      )}
    </main>
  );
}
