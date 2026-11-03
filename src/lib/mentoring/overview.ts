import { prisma } from "@/lib/prisma";
import { getEnrolledUserIds } from "@/lib/enrollment-store";

/**
 * 세특·과제 현황 하단 '일괄 처리' 패널용 학생별 진행 현황 — 최근 정리 PDF·AI 세특·최근 평가 보고서(보냄 여부).
 * 날짜는 ISO 문자열(클라에서 KST 표기).
 */
export type OverviewRow = {
  id: string;
  name: string;
  submittedColumns: number[];
  hasReportFile: boolean;
  dossier: { id: string; label: string; createdAt: string } | null;
  aiEval: { generatedAt: string; byteCount: number; edited: boolean; applied: boolean } | null;
  report: { id: string; label: string; createdAt: string; sentAt: string | null } | null;
};

type GenFileRow = { id: string; studentId: string; kind: string; label: string; createdAt: Date; sentAt: Date | null };
/** 생성 파일 목록 — `sentAt` 컬럼이 아직 DB에 없으면(배포 전) sentAt 없이 재조회해 현황이 깨지지 않게 한다. */
async function loadGenFiles(courseId: string, ids: string[]): Promise<GenFileRow[]> {
  const where = { courseId, studentId: { in: ids } };
  try {
    return await prisma.mentoringGenFile.findMany({ where, orderBy: { createdAt: "desc" }, select: { id: true, studentId: true, kind: true, label: true, createdAt: true, sentAt: true } });
  } catch {
    const rows = await prisma.mentoringGenFile.findMany({ where, orderBy: { createdAt: "desc" }, select: { id: true, studentId: true, kind: true, label: true, createdAt: true } });
    return rows.map((r) => ({ ...r, sentAt: null }));
  }
}

export async function loadAiEvalOverview(courseId: string): Promise<OverviewRow[]> {
  const ids = await getEnrolledUserIds(courseId);
  if (!ids.length) return [];
  const [users, files, evals, setes, asgs, reps] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids }, lifecycleStatus: "ACTIVE" }, select: { id: true, email: true, studentProfile: { select: { realName: true } } } }),
    loadGenFiles(courseId, ids),
    prisma.mentoringAiEval.findMany({ where: { courseId, studentId: { in: ids } }, select: { studentId: true, evalText: true, byteCount: true, editedBy: true, generatedAt: true } }),
    prisma.mentoringSete.findMany({ where: { courseId, studentId: { in: ids } }, select: { studentId: true, body: true } }),
    prisma.mentoringAssignment.findMany({ where: { courseId, studentId: { in: ids } }, select: { studentId: true, column: true } }),
    prisma.mentoringReport.findMany({ where: { courseId, studentId: { in: ids } }, select: { studentId: true, fileName: true } }),
  ]);

  // 학생별 최신 파일(kind 별) — files 는 createdAt desc 라 처음 만나는 것이 최신
  const latest = new Map<string, (typeof files)[number]>();
  for (const f of files) {
    const k = `${f.studentId}:${f.kind}`;
    if (!latest.has(k)) latest.set(k, f);
  }
  const evalBy = new Map(evals.map((e) => [e.studentId, e]));
  const seteBy = new Map(setes.map((s) => [s.studentId, s.body]));
  const colsBy = new Map<string, Set<number>>();
  for (const a of asgs) colsBy.set(a.studentId, new Set([...(colsBy.get(a.studentId) ?? []), a.column]));
  const hasRep = new Set(reps.filter((r) => !!r.fileName).map((r) => r.studentId));

  return users
    .map((u) => {
      const d = latest.get(`${u.id}:dossier`);
      const r = latest.get(`${u.id}:report`);
      const e = evalBy.get(u.id);
      const evalText = (e?.evalText ?? "").trim();
      const applied = !!evalText && (seteBy.get(u.id) ?? "").trim() === evalText;
      return {
        id: u.id,
        name: u.studentProfile?.realName || u.email,
        submittedColumns: [...(colsBy.get(u.id) ?? [])].sort((a, b) => a - b),
        hasReportFile: hasRep.has(u.id),
        dossier: d ? { id: d.id, label: d.label, createdAt: d.createdAt.toISOString() } : null,
        aiEval: e && evalText ? { generatedAt: e.generatedAt.toISOString(), byteCount: e.byteCount, edited: !!e.editedBy, applied } : null,
        report: r ? { id: r.id, label: r.label, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt ? r.sentAt.toISOString() : null } : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
