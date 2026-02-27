export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)]">
      <section className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-bold text-slate-100">학생 인증</h1>
      <p className="mb-6 text-sm text-slate-400">학생증 또는 재학증명서를 제출하면 관리자 검토 후 승인됩니다.</p>
      <form
        className="space-y-4 rounded-2xl bg-[color:var(--surface)] p-6"
        action="/api/verify/submit"
        method="post"
        encType="multipart/form-data"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <input name="realName" placeholder="실명" className="rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" required />
          <input name="schoolName" placeholder="학교명" className="rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" required />
          <input name="grade" placeholder="학년" className="rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" required />
          <input name="className" placeholder="반 (선택)" className="rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" />
          <input name="number" placeholder="번호 (선택)" className="rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" />
          <select name="docType" className="rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2" required>
            <option value="STUDENT_ID">학생증</option>
            <option value="ENROLLMENT_CERTIFICATE">재학증명서</option>
          </select>
        </div>
        <input
          name="file"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          className="block w-full rounded-md border border-slate-600 bg-[color:var(--surface-elevated)] px-3 py-2"
          required
        />
        <p className="text-sm text-slate-400">허용: png/jpg/webp/pdf, 최대 10MB</p>
        <button className="rounded-md bg-slate-100 px-4 py-2 text-slate-900" type="submit">
          제출하기
        </button>
      </form>
      </section>
    </main>
  );
}
