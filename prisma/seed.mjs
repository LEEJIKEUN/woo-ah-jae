import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@wooahjae.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const seedDemoUsers =
    process.env.SEED_DEMO_USERS === "true" ||
    (process.env.SEED_DEMO_USERS == null && process.env.NODE_ENV !== "production");
  const studentOwnerEmail = process.env.SEED_STUDENT_OWNER_EMAIL || "student.owner@wooahjae.local";
  const studentOwnerPassword = process.env.SEED_STUDENT_OWNER_PASSWORD || "Student123!";
  const studentApplicantEmail = process.env.SEED_STUDENT_APPLICANT_EMAIL || "student.applicant@wooahjae.local";
  const studentApplicantPassword = process.env.SEED_STUDENT_APPLICANT_PASSWORD || "Student123!";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: UserRole.ADMIN },
    create: { email: adminEmail, passwordHash, role: UserRole.ADMIN },
  });

  if (seedDemoUsers) {
    const ownerHash = await bcrypt.hash(studentOwnerPassword, 12);
    const applicantHash = await bcrypt.hash(studentApplicantPassword, 12);

    const owner = await prisma.user.upsert({
      where: { email: studentOwnerEmail },
      update: { passwordHash: ownerHash, role: UserRole.STUDENT },
      create: { email: studentOwnerEmail, passwordHash: ownerHash, role: UserRole.STUDENT },
    });

    const applicant = await prisma.user.upsert({
      where: { email: studentApplicantEmail },
      update: { passwordHash: applicantHash, role: UserRole.STUDENT },
      create: { email: studentApplicantEmail, passwordHash: applicantHash, role: UserRole.STUDENT },
    });

    await prisma.studentProfile.upsert({
      where: { userId: owner.id },
      update: {
        realName: "프로젝트대표",
        schoolName: "상해한국학교",
        grade: "G11",
        className: "A",
        number: "11",
        residenceCountry: "CN",
      },
      create: {
        userId: owner.id,
        realName: "프로젝트대표",
        schoolName: "상해한국학교",
        grade: "G11",
        className: "A",
        number: "11",
        residenceCountry: "CN",
      },
    });

    await prisma.studentProfile.upsert({
      where: { userId: applicant.id },
      update: {
        realName: "지원학생",
        schoolName: "싱가포르한국국제학교",
        grade: "G10",
        className: "B",
        number: "7",
        residenceCountry: "SG",
      },
      create: {
        userId: applicant.id,
        realName: "지원학생",
        schoolName: "싱가포르한국국제학교",
        grade: "G10",
        className: "B",
        number: "7",
        residenceCountry: "SG",
      },
    });

    const ownerVerification = await prisma.verificationSubmission.findFirst({
      where: { userId: owner.id, status: "VERIFIED" },
    });
    if (!ownerVerification) {
      await prisma.verificationSubmission.create({
        data: {
          userId: owner.id,
          status: "VERIFIED",
          docType: "STUDENT_ID",
          fileKey: "seed/owner.png",
          originalFilename: "owner.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          reviewedAt: new Date(),
          reviewedBy: admin.id,
        },
      });
    }

    const applicantVerification = await prisma.verificationSubmission.findFirst({
      where: { userId: applicant.id, status: "VERIFIED" },
    });
    if (!applicantVerification) {
      await prisma.verificationSubmission.create({
        data: {
          userId: applicant.id,
          status: "VERIFIED",
          docType: "STUDENT_ID",
          fileKey: "seed/applicant.png",
          originalFilename: "applicant.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          reviewedAt: new Date(),
          reviewedBy: admin.id,
        },
      });
    }
  }

  await prisma.featureFlag.upsert({
    where: { key: "billingEnabled" },
    update: { valueBool: false },
    create: { key: "billingEnabled", valueBool: false },
  });

  await prisma.plan.upsert({
    where: { code: "FREE" },
    update: { name: "Free" },
    create: { code: "FREE", name: "Free", description: "MVP 기본 무료 플랜" },
  });

  const admissionsGroups = [
    {
      sortOrder: 1,
      name: "특례/전형 기본",
      boards: [
        { slug: "special-eligibility-prep", name: "특례 자격조건 및 준비", sortOrder: 1 },
        { slug: "overseas-korean-special", name: "재외국민 특례", sortOrder: 2 },
        { slug: "foreign-university-track", name: "외국대 전형", sortOrder: 3 },
        { slug: "early-special-talent", name: "수시 및 특기자", sortOrder: 4 },
      ],
    },
    {
      sortOrder: 2,
      name: "교육 및 입시 소식",
      boards: [{ slug: "education-admission-news", name: "교육 및 입시 관련 소식", sortOrder: 1 }],
    },
    {
      sortOrder: 3,
      name: "특례 과목",
      boards: [
        { slug: "special-math", name: "특례 수학", sortOrder: 1 },
        { slug: "special-korean", name: "특례 국어", sortOrder: 2 },
        { slug: "special-english", name: "특례 영어", sortOrder: 3 },
      ],
    },
    {
      sortOrder: 4,
      name: "공인시험/트랙",
      boards: [
        { slug: "korean-curriculum", name: "한국교육과정", sortOrder: 1 },
        { slug: "sat-act", name: "SAT, ACT", sortOrder: 2 },
        { slug: "ibt-toeic-teps", name: "iBT. TOEIC. TEPS", sortOrder: 3 },
        { slug: "ib", name: "IB", sortOrder: 4 },
        { slug: "ap", name: "AP", sortOrder: 5 },
        { slug: "a-level", name: "A-level", sortOrder: 6 },
      ],
    },
  ];

  const boardStudy = await prisma.boardChannel.upsert({
    where: { slug: "study-admission" },
    update: {
      communityKey: "exam-community",
      groupId: null,
      name: "학습+입시 정보 공유",
      description: "학습법과 입시 정보를 공유하는 채널입니다.",
      sortOrder: 1,
      isNotice: false,
    },
    create: {
      communityKey: "exam-community",
      slug: "study-admission",
      name: "학습+입시 정보 공유",
      description: "학습법과 입시 정보를 공유하는 채널입니다.",
      sortOrder: 1,
      isNotice: false,
    },
  });

  const boardTalk = await prisma.boardChannel.upsert({
    where: { slug: "talk" },
    update: {
      communityKey: "exam-community",
      groupId: null,
      name: "이야기 나눠요",
      description: "자유롭게 일상과 경험을 나누는 채널입니다.",
      sortOrder: 2,
      isNotice: false,
    },
    create: {
      communityKey: "exam-community",
      slug: "talk",
      name: "이야기 나눠요",
      description: "자유롭게 일상과 경험을 나누는 채널입니다.",
      sortOrder: 2,
      isNotice: false,
    },
  });

  await prisma.boardChannel.upsert({
    where: { slug: "notice" },
    update: {
      communityKey: "admissions",
      groupId: null,
      name: "공지사항",
      description: "입시 공지와 운영 공지를 확인하는 게시판",
      sortOrder: 0,
      isNotice: true,
    },
    create: {
      communityKey: "admissions",
      slug: "notice",
      name: "공지사항",
      description: "입시 공지와 운영 공지를 확인하는 게시판",
      sortOrder: 0,
      isNotice: true,
    },
  });

  for (const group of admissionsGroups) {
    const groupRow = await prisma.boardGroup.upsert({
      where: {
        communityKey_name: {
          communityKey: "admissions",
          name: group.name,
        },
      },
      update: { sortOrder: group.sortOrder },
      create: {
        communityKey: "admissions",
        name: group.name,
        sortOrder: group.sortOrder,
      },
    });

    for (const board of group.boards) {
      await prisma.boardChannel.upsert({
        where: { slug: board.slug },
        update: {
          communityKey: "admissions",
          groupId: groupRow.id,
          name: board.name,
          description: `${board.name} 게시판`,
          sortOrder: board.sortOrder,
          isNotice: false,
        },
        create: {
          communityKey: "admissions",
          groupId: groupRow.id,
          slug: board.slug,
          name: board.name,
          description: `${board.name} 게시판`,
          sortOrder: board.sortOrder,
          isNotice: false,
        },
      });
    }
  }

  const hasBoardPosts = await prisma.boardPost.count();
  if (hasBoardPosts === 0) {
    await prisma.boardPost.createMany({
      data: [
        {
          id: "seed-board-post-1",
          boardChannelId: boardStudy.id,
          authorId: admin.id,
          categoryTag: "공지",
          title: "채널 이용 안내",
          content: "질문/정보/후기 말머리를 활용해 학습 정보를 공유해 주세요.",
          isNotice: true,
          isPinned: true,
        },
        {
          id: "seed-board-post-2",
          boardChannelId: boardTalk.id,
          authorId: admin.id,
          categoryTag: "공지",
          title: "자유 대화 가이드",
          content: "서로 존중하는 커뮤니티 문화를 지켜주세요.",
          isNotice: true,
          isPinned: true,
        },
      ],
    });
  }

  console.log(
    `Seed completed: ADMIN${seedDemoUsers ? " + demo STUDENT users" : ""}, billingEnabled=false, FREE plan, board communities`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
