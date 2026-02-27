export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-4 text-3xl font-bold">그룹 #{id}</h1>
      <p className="text-slate-600">그룹 비밀번호 입장/게시판은 다음 단계에서 연결됩니다.</p>
    </main>
  );
}
