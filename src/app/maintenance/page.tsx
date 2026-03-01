import Link from "next/link";

export const dynamic = "force-static";

export default function MaintenancePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-2xl font-semibold">시스템 점검 중입니다.</div>
      <p className="text-lg text-gray-300">일시적으로 서비스 이용이 중단됩니다. 잠시 후 다시 이용해 주세요.</p>
      <Link
        href="/login"
        className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
      >
        관리자 로그인
      </Link>
    </div>
  );
}
