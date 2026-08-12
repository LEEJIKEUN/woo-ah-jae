import Link from "next/link";

export default function SignupSuccessPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-3 text-3xl font-bold">회원가입이 완료되었습니다.</h1>
      <p className="mb-8 text-slate-600">이제 로그인하여 우아재를 이용하실 수 있습니다.</p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-md px-5 py-2.5 font-medium text-white" style={{ background: "#8C6E59" }}>
          로그인하기
        </Link>
        <Link href="/" className="rounded-md border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700">
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
