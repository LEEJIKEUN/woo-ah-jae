import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import CloneGuide from "./CloneGuide";

export const metadata = { title: "새 강좌 개설 · 우아재" };

export default async function NewCoursePage() {
  let role: string | null = null;
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) {
      const session = await verifySessionToken(token);
      role = session?.role ?? null;
    }
  } catch {
    role = null;
  }

  if (role !== "ADMIN") redirect("/course");

  return <CloneGuide />;
}
