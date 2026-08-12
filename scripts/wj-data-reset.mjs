// 우아재 데이터 리셋 — 관리자(ADMIN) 계정만 남기고 학생·콘텐츠 전부 삭제.
// 사용:
//   node scripts/wj-data-reset.mjs backup   # 전체 DB → JSON 백업 (삭제 없음)
//   node scripts/wj-data-reset.mjs purge     # 백업이 존재해야만 삭제 수행
//
// Restrict FK(Project.owner, Post/Comment.author, Announcement.author, AuditLog.actor)
// 때문에 자식 → 소유자 → 유저 순으로 삭제한다.
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(__dirname, "..", ".local_data", "backups");

// 백업할 전체 모델(스키마 상 존재하는 것 전부)
const MODELS = [
  "user", "studentProfile", "passwordResetToken", "verificationSubmission",
  "announcement", "maintenance", "project", "group", "groupMember", "post",
  "comment", "auditLog", "application", "projectMember", "workspaceConfig",
  "chatMessage", "workspaceFile", "todoItem", "projectLike", "projectComment",
  "workspaceSchedule", "featureFlag", "plan", "entitlement", "boardChannel",
  "boardGroup", "boardPost", "boardComment", "boardPostLike", "boardReport",
  "boardPostView",
];

async function backup() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const dump = {};
  for (const m of MODELS) {
    try {
      dump[m] = await prisma[m].findMany();
    } catch (e) {
      dump[m] = { __error: e.message };
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(BACKUP_DIR, `full-backup-${stamp}.json`);
  writeFileSync(file, JSON.stringify(dump, null, 2), "utf8");
  const counts = Object.fromEntries(
    Object.entries(dump).map(([k, v]) => [k, Array.isArray(v) ? v.length : "ERR"])
  );
  console.log("✅ 백업 완료:", file);
  console.log(JSON.stringify(counts, null, 2));
  return file;
}

function latestBackup() {
  try {
    const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("full-backup-") && f.endsWith(".json"));
    return files.sort().at(-1) ?? null;
  } catch {
    return null;
  }
}

async function purge() {
  const bk = latestBackup();
  if (!bk) {
    console.error("⛔ 백업 파일이 없습니다. 먼저 `backup` 을 실행하세요.");
    process.exit(1);
  }
  console.log("사용 백업:", join(BACKUP_DIR, bk));

  // 유지: 관리자(ADMIN) + 아래 이메일(본인 계정)
  const KEEP_EMAILS = ["yigig1@naver.com"];
  const keep = await prisma.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { email: { in: KEEP_EMAILS } }] },
    select: { id: true, email: true, role: true },
  });
  const students = await prisma.user.findMany({
    where: { AND: [{ role: { not: "ADMIN" } }, { email: { notIn: KEEP_EMAILS } }] },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);
  console.log(`유지할 계정 ${keep.length}명:`, keep.map((a) => `${a.email}(${a.role})`).join(", "));
  console.log(`삭제할 학생 ${studentIds.length}명`);

  if (studentIds.length === 0) {
    console.log("삭제할 학생이 없습니다.");
    return;
  }

  const inStudents = { in: studentIds };

  const result = await prisma.$transaction(async (tx) => {
    // 1) Restrict FK 자식들 먼저
    const auditLogs = await tx.auditLog.deleteMany({ where: { actorUserId: inStudents } });
    const comments = await tx.comment.deleteMany({ where: { createdBy: inStudents } });
    const posts = await tx.post.deleteMany({ where: { createdBy: inStudents } });
    const announcements = await tx.announcement.deleteMany({ where: { createdBy: inStudents } });
    // 2) 학생 소유 프로젝트 (cascade: application/member/workspace*/group/like/comment)
    const projects = await tx.project.deleteMany({ where: { ownerId: inStudents } });
    // 3) 학생 유저 (cascade: profile/verification/boardPost/application/likes/... 나머지)
    const users = await tx.user.deleteMany({ where: { id: inStudents } });
    return {
      auditLogs: auditLogs.count,
      comments: comments.count,
      posts: posts.count,
      announcements: announcements.count,
      projects: projects.count,
      users: users.count,
    };
  });

  console.log("🗑️ 삭제 완료:", JSON.stringify(result, null, 2));

  // 삭제 후 현황
  const after = {
    users: await prisma.user.count(),
    admins: await prisma.user.count({ where: { role: "ADMIN" } }),
    students: await prisma.user.count({ where: { role: { not: "ADMIN" } } }),
    projects: await prisma.project.count(),
    applications: await prisma.application.count(),
    boardPosts: await prisma.boardPost.count(),
    boardComments: await prisma.boardComment.count(),
    verificationSubmissions: await prisma.verificationSubmission.count(),
  };
  console.log("📊 삭제 후 현황:", JSON.stringify(after, null, 2));
}

const mode = process.argv[2];
(async () => {
  if (mode === "backup") await backup();
  else if (mode === "purge") await purge();
  else {
    console.error("모드를 지정하세요: backup | purge");
    process.exit(1);
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("ERR", e);
  await prisma.$disconnect();
  process.exit(1);
});
