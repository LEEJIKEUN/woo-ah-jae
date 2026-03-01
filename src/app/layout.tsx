import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Noto_Sans_KR } from "next/font/google";
import Header from "@/components/nav/Header";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MaintenanceBanner from "@/components/system/MaintenanceBanner";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Woo Ah Jae",
  description: "우리만 아는 재외국민특별전형 학생 프로젝트 커뮤니티",
};

async function getSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  let accountLabel: string | undefined;

  if (session) {
    const emailLocalPart = session.email.split("@")[0] || "사용자";
    const fallbackBase = emailLocalPart;

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          role: true,
          studentProfile: {
            select: {
              schoolName: true,
              grade: true,
              realName: true,
            },
          },
        },
      });

      const name = user?.studentProfile?.realName?.trim() || emailLocalPart;
      accountLabel = name;
    } catch {
      accountLabel = fallbackBase;
    }
  }

  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} min-h-screen antialiased`}>
        <MaintenanceBanner />
        <Header
          session={
            session
              ? {
                  userId: session.userId,
                  role: session.role,
                  email: session.email,
                }
              : null
          }
          accountLabel={accountLabel}
        />
        {children}
      </body>
    </html>
  );
}
