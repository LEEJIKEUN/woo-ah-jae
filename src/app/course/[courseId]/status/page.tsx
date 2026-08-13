import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { requireClassroomAccess, isStaffRole } from "@/lib/course/access";
import { getEnrolledUserIds } from "@/lib/enrollment-store";
import { getCourse } from "@/lib/course/content";
import { prisma } from "@/lib/prisma";
import ClassroomSidebar from "@/components/course/ClassroomSidebar";
import PeerReviewButton from "./PeerReviewButton";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: "세특·과제 현황 · 우아재" };
}

const BROWN = "#8C6E59";
const INK = "#2C2823";
const BODY = "#334155";
const SUB = "#8A8479";
const MUTED = "#94a3b8";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";
const serif = { fontFamily: "var(--font-serif)" } as const;

const MAX_ASSIGN_COLS = 5;

export default async function StatusPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireClassroomAccess(courseId, `/course/${courseId}/status`);
  if (!isStaffRole(session.role)) redirect(`/course/${courseId}/learn`);

  const course = getCourse(courseId);
  const ids = await getEnrolledUserIds(courseId);

  const [users, setes, books, assignments] = await Promise.all([
    ids.length ? prisma.user.findMany({ where: { id: { in: ids }, lifecycleStatus: "ACTIVE" }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } }) : Promise.resolve([]),
    ids.length ? prisma.mentoringSete.findMany({ where: { courseId, studentId: { in: ids } }, select: { studentId: true, body: true } }) : Promise.resolve([]),
    ids.length ? prisma.mentoringBook.findMany({ where: { courseId, studentId: { in: ids } }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }], select: { studentId: true, book: true, author: true } }) : Promise.resolve([]),
    ids.length ? prisma.mentoringAssignment.findMany({ where: { courseId, studentId: { in: ids } }, orderBy: { column: "asc" }, select: { id: true, studentId: true, name: true, mime: true, column: true } }) : Promise.resolve([]),
  ]);

  const seteMap = new Map(setes.map((s) => [s.studentId, s.body]));
  const booksMap = new Map<string, string[]>();
  for (const b of books) {
    const label = `${b.book || "(제목 없음)"}${b.author ? `(${b.author})` : ""}`;
    booksMap.set(b.studentId, [...(booksMap.get(b.studentId) ?? []), label]);
  }
  const asgMap = new Map<string, { id: string; name: string; mime: string; column: number }[]>();
  for (const a of assignments) {
    asgMap.set(a.studentId, [...(asgMap.get(a.studentId) ?? []), { id: a.id, name: a.name, mime: a.mime, column: a.column }]);
  }

  const rows = users
    .map((u) => {
      const sete = seteMap.get(u.id) ?? "";
      return {
        id: u.id,
        name: u.studentProfile?.realName || u.email,
        sete,
        byte: Buffer.byteLength(sete, "utf8"),
        books: (booksMap.get(u.id) ?? []).join(", "),
        assignments: asgMap.get(u.id) ?? [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const studentsForClient = rows.map((r) => ({ id: r.id, name: r.name, submittedColumns: r.assignments.map((a) => a.column) }));

  const th = "whitespace-nowrap border-b px-3 py-2.5 text-left text-[12.5px] font-bold";
  const td = "border-b px-3 py-2.5 align-top text-[13px]";

  return (
    <div className="flex w-full items-start" style={{ background: "#fff" }}>
      <ClassroomSidebar courseId={courseId} isStaff />

      <main className="min-w-0 flex-1 px-6 py-8 lg:px-8">
        <Link href={`/course/${courseId}/learn`} className="mb-1 inline-flex items-center gap-1 text-[13px]" style={{ color: BROWN }}>
          <ChevronLeft size={14} /> 강의실
        </Link>
        <h1 className="text-[26px] font-normal" style={{ ...serif, color: INK }}>세특·과제 현황</h1>
        <p className="mt-1 text-[13.5px]" style={{ color: SUB }}>
          {course?.title ?? courseId} · 수강생 {rows.length}명 · 이름 오름차순. 과제는 최대 {MAX_ASSIGN_COLS}개까지 표시됩니다.
        </p>

        <div className="mt-5 overflow-x-auto rounded-[12px] border" style={{ borderColor: CARD }}>
          <table className="w-full border-collapse" style={{ minWidth: 1000 }}>
            <thead>
              <tr style={{ background: PANEL, color: INK }}>
                <th className={`${th} sticky z-20`} style={{ borderColor: CARD, width: 56, minWidth: 56, left: 0, background: PANEL }}>번호</th>
                <th className={`${th} sticky z-20`} style={{ borderColor: CARD, width: 120, minWidth: 120, left: 56, background: PANEL, boxShadow: "6px 0 8px -6px rgba(0,0,0,0.18)" }}>이름</th>
                <th className={th} style={{ borderColor: CARD, minWidth: 300 }}>과목별 세부능력 특기사항</th>
                <th className={th} style={{ borderColor: CARD, width: 64 }}>byte</th>
                <th className={th} style={{ borderColor: CARD, minWidth: 200 }}>독서활동상황</th>
                {Array.from({ length: MAX_ASSIGN_COLS }, (_, i) => (
                  <th key={i} className={th} style={{ borderColor: CARD, minWidth: 120 }}>
                    <span className="inline-flex items-center gap-1.5">
                      과제{i + 1}
                      <PeerReviewButton courseId={courseId} column={i} label={`과제${i + 1}`} students={studentsForClient} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className={td} style={{ borderColor: CARD, color: SUB }} colSpan={5 + MAX_ASSIGN_COLS}>수강 중인 학생이 없습니다.</td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className={`${td} sticky z-10`} style={{ borderColor: CARD, color: MUTED, left: 0, background: "#fff" }}>{i + 1}</td>
                    <td className={`${td} sticky z-10`} style={{ borderColor: CARD, left: 56, background: "#fff", boxShadow: "6px 0 8px -6px rgba(0,0,0,0.18)" }}>
                      <Link href={`/course/${courseId}/mentoring?student=${r.id}`} className="font-semibold hover:underline" style={{ color: INK }} title="멘토링에서 세특 작성">
                        {r.name}
                      </Link>
                    </td>
                    <td className={td} style={{ borderColor: CARD, color: BODY }}>
                      {r.sete ? <span className="whitespace-pre-line leading-6">{r.sete}</span> : <span style={{ color: MUTED }}>-</span>}
                    </td>
                    <td className={td} style={{ borderColor: CARD, color: r.byte > 500 ? "#a6402c" : MUTED, textAlign: "right" }}>{r.byte}</td>
                    <td className={td} style={{ borderColor: CARD, color: BODY }}>
                      {r.books ? <span className="leading-6">{r.books}</span> : <span style={{ color: MUTED }}>-</span>}
                    </td>
                    {Array.from({ length: MAX_ASSIGN_COLS }, (_, ci) => {
                      const a = r.assignments.find((x) => x.column === ci);
                      return (
                        <td key={ci} className={td} style={{ borderColor: CARD }}>
                          {a ? (
                            <a href={`/api/courses/${courseId}/mentoring/assignment/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex max-w-[160px] items-center gap-1" style={{ color: BROWN }} title={a.name}>
                              <span className="truncate">{a.name}</span>
                            </a>
                          ) : (
                            <span style={{ color: MUTED }}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.some((r) => r.assignments.some((a) => a.column >= MAX_ASSIGN_COLS)) ? (
          <p className="mt-2 text-[12px]" style={{ color: MUTED }}>* 과제 {MAX_ASSIGN_COLS}번을 넘는 슬롯은 표에 표시되지 않습니다. 전체는 학생 멘토링 페이지에서 확인하세요.</p>
        ) : null}
        <p className="mt-1 flex items-center gap-1 text-[12px]" style={{ color: MUTED }}>
          <Download size={12} /> 과제 파일명을 누르면 새 탭에서 열립니다. 세특은 이름을 눌러 학생 멘토링에서 작성/수정합니다.
        </p>
      </main>
    </div>
  );
}
