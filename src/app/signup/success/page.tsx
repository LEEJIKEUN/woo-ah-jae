import Link from "next/link";

export default async function SignupSuccessPage({ searchParams }: { searchParams: Promise<{ pending?: string }> }) {
  const { pending } = await searchParams;
  const isPending = pending === "1";

  if (isPending) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-3xl font-bold">신청이 접수되었습니다.</h1>
        <p className="mb-2 text-slate-600">관리자 승인이 완료되면 회원가입이 완료됩니다.</p>
        <p className="mb-8 text-slate-500">승인 결과는 가입하신 이메일로 안내드립니다. 조금만 기다려 주세요.</p>
        <Link href="/" className="rounded-md px-5 py-2.5 font-medium text-white" style={{ background: "#8C6E59" }}>
          홈으로
        </Link>
      </main>
    );
  }

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
