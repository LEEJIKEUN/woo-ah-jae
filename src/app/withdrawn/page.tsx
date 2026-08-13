import Link from "next/link";

/** 회원 탈퇴 완료 안내 — 로그인 없이 접근하는 깔끔한 빈 페이지. */
export default function WithdrawnPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-6 text-[color:var(--foreground)]">
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-800">탈퇴가 완료되었습니다.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline">
          홈으로
        </Link>
      </div>
    </main>
  );
}
