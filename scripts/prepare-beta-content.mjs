import { PrismaClient, ProjectStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_ADMIN_SCRIPT !== "true") {
  throw new Error(
    "[safety-lock] prepare-beta-content is blocked in production. Set ALLOW_DESTRUCTIVE_ADMIN_SCRIPT=true only for explicit maintenance."
  );
}

const usageNoticeBody = `안녕하세요.
WooAhJae는 재외국민 및 국제학교 학생들을 위한 학습·프로젝트 협업 플랫폼입니다.

1. 회원가입 및 승인
- 실명, 학교, 학년 정보를 정확히 입력해주세요.
- 재학증명서 또는 학생증 업로드 후 관리자 승인 시 전체 기능 이용이 가능합니다.

2. 프로젝트 참여
- 교과/창체/교내대회/교외대회/공인시험 탭에서 프로젝트를 탐색할 수 있습니다.
- 프로젝트 상세에서 신청서를 작성하고 대표 학생 승인 후 참여할 수 있습니다.

3. 협업 공간
- 팀 채팅, 파일 공유, Google Drive/Sheet/Docs, Zoom 링크 공유를 지원합니다.
- 일정 관리 달력과 공지를 통해 팀 협업을 체계적으로 진행할 수 있습니다.

4. 커뮤니티 게시판
- 학습+입시 정보 공유 / 이야기 나눠요 게시판에서 정보와 경험을 나눌 수 있습니다.

5. 이용 유의사항
- 허위 정보, 타인 비방, 무단 자료 공유를 금지합니다.
- 개인정보 보호에 유의해주세요.

WooAhJae는 계속 개선 중입니다. 감사합니다.`;

const projectSamples = [
  {
    title: "교과 수학 심화 문제해결 팀",
    summary: "SAT/AP/내신 공통 고난도 문제 풀이 중심 스터디",
    description:
      "수학 상위권 학생들이 주 2회 온라인으로 모여 고난도 문항을 풀이하고 해설 방식을 공유합니다.",
    tab: "교과",
    channel: "수학",
    capacity: 6,
    requirements: "기본 미적분/함수 단원 이수자",
    rolesNeeded: "문항 제작 2명, 해설 발표 2명, 기록 1명",
  },
  {
    title: "창체 진로인터뷰 질문지 공동 제작",
    summary: "진로활동 포트폴리오 완성용 질문/답변 템플릿 제작",
    description:
      "진로 탐색 활동을 체계화하기 위해 전공별 인터뷰 질문지와 회고 템플릿을 제작합니다.",
    tab: "창체",
    channel: "진로활동",
    capacity: 5,
    requirements: "희망 전공 관련 조사 경험",
    rolesNeeded: "리서치 2명, 문서 편집 2명, 발표 1명",
  },
  {
    title: "교내대회 MUN 포지션 페이퍼 집중반",
    summary: "MUN 대회 대비 포지션 페이퍼와 스피치 훈련",
    description:
      "교내 MUN 준비를 위해 의제 리서치부터 포지션 페이퍼 작성, 스피치 리허설까지 함께 진행합니다.",
    tab: "교내대회",
    channel: "MUN",
    capacity: 8,
    requirements: "영문 기사 읽기 가능",
    rolesNeeded: "의제 리서치 3명, 스피치 코칭 2명, 문서 리뷰 2명",
  },
  {
    title: "교외대회 전국학생통계활용대회 준비팀",
    summary: "통계청 대회 출품용 데이터 분석/시각화 팀",
    description:
      "실제 공개 데이터를 분석해 스토리텔링 기반 통계 포스터를 제작하고 발표 자료까지 완성합니다.",
    tab: "교외대회",
    channel: "전국학생통계활용대회(통계청)",
    capacity: 7,
    requirements: "기본 스프레드시트 사용 가능",
    rolesNeeded: "데이터 분석 3명, 디자인 2명, 발표 2명",
  },
  {
    title: "공인시험 SAT Math 780+ 집중 코호트",
    summary: "SAT Math 고득점 목표 주간 테스트/오답관리",
    description:
      "SAT Math 780+를 목표로 주간 모의테스트와 오답 노트, 약점 단원 코칭을 운영합니다.",
    tab: "공인시험",
    channel: "SAT",
    capacity: 10,
    requirements: "최근 SAT Math 650+",
    rolesNeeded: "오답리뷰 리더 2명, 문제선정 2명, 학습관리 1명",
  },
];

const boardSamples = {
  "study-admission": [
    {
      categoryTag: "정보",
      title: "SAT Reading 오답률 줄이는 루틴 공유",
      content: "지문 유형별로 오답 원인을 분류하는 방법과 주간 루틴 예시를 정리했습니다.",
      likeCount: 9,
      commentCount: 3,
      viewCount: 121,
    },
    {
      categoryTag: "질문",
      title: "IB EE 주제 선정 시 피해야 할 실수",
      content: "범위를 너무 넓게 잡는 문제를 줄이기 위해 체크리스트를 공유합니다.",
      likeCount: 7,
      commentCount: 5,
      viewCount: 98,
    },
    {
      categoryTag: "후기",
      title: "TOEFL Speaking 2주 집중 트랙 후기",
      content: "템플릿 기반 훈련으로 점수 상승한 경험을 공유합니다.",
      likeCount: 6,
      commentCount: 2,
      viewCount: 86,
    },
    {
      categoryTag: "정보",
      title: "AP Calculus BC 준비 자료 정리본",
      content: "유형별 기출 링크, 개념 요약, 주차별 학습 계획표를 모았습니다.",
      likeCount: 8,
      commentCount: 4,
      viewCount: 110,
    },
    {
      categoryTag: "질문",
      title: "재외국민 전형 자기소개서 구조 피드백 요청",
      content: "경험-성장-기여 구조로 작성했는데 논리 흐름 조언 부탁드립니다.",
      likeCount: 5,
      commentCount: 6,
      viewCount: 75,
    },
  ],
  talk: [
    {
      categoryTag: "일상",
      title: "이번 주 공부 루틴 공유해요",
      content: "다른 학교 친구들은 하루 공부 시간을 어떻게 배분하는지 궁금합니다.",
      likeCount: 4,
      commentCount: 7,
      viewCount: 65,
    },
    {
      categoryTag: "응원",
      title: "모의고사 끝난 사람들 고생했어요",
      content: "결과와 상관없이 다음 주 계획 다시 세워봅시다.",
      likeCount: 10,
      commentCount: 8,
      viewCount: 140,
    },
    {
      categoryTag: "질문",
      title: "프로젝트 면접 준비 같이 할 사람?",
      content: "자기소개 1분 스크립트 피드백 주고받을 팀원을 찾습니다.",
      likeCount: 3,
      commentCount: 4,
      viewCount: 51,
    },
    {
      categoryTag: "후기",
      title: "워크스페이스 일정관리 기능 써본 후기",
      content: "팀 과제 마감 관리에 도움이 된 사용 팁을 공유합니다.",
      likeCount: 6,
      commentCount: 1,
      viewCount: 73,
    },
    {
      categoryTag: "자유",
      title: "오늘 공부 인증 스레드",
      content: "각자 오늘 한 공부를 댓글로 인증해요!",
      likeCount: 11,
      commentCount: 12,
      viewCount: 167,
    },
  ],
};

const admissionsSampleBySlug = {
  "special-eligibility-prep": "특례 자격 준비 체크리스트 최신판 공유",
  "education-admission-news": "2026학년도 재외국민 전형 주요 일정 정리",
  "overseas-korean-special": "재외국민 특례 자기소개서 작성 팁",
  "special-math": "특례 수학 빈출 유형 20선",
  "special-korean": "특례 국어 비문학 시간 단축 전략",
  "special-english": "특례 영어 독해 루틴 가이드",
  "foreign-university-track": "해외대학 지원 포트폴리오 준비 순서",
  "early-special-talent": "수시/특기자 활동증빙 정리 방법",
  "korean-curriculum": "한국교육과정 과목 선택과 기록 팁",
  "sat-act": "SAT/ACT 응시 전략 비교 정리",
  "ibt-toeic-teps": "iBT·TOEIC·TEPS 점수 활용 가이드",
  ib: "IB 과목 조합 선택 Q&A",
  ap: "AP 과목별 추천 학습자료 모음",
  "a-level": "A-level 과목별 학습 플래너 샘플",
};

async function prepareBetaContent() {
  const admin =
    (await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!admin) {
    throw new Error("No user found. Create at least one admin/user first.");
  }

  const ownerCandidate =
    (await prisma.user.findFirst({
      where: { role: UserRole.STUDENT },
      orderBy: { createdAt: "asc" },
    })) ?? admin;

  await prisma.$transaction(async (tx) => {
    // 1) 기존 연습 프로젝트/협업 흔적 삭제
    await tx.project.deleteMany();

    // 2) 기존 게시판 글/반응 정리
    await tx.boardPost.deleteMany({
      where: {
        boardChannel: {
          communityKey: { in: ["exam-community", "admissions"] },
        },
      },
    });

    // 3) 홈 공지: 이용 안내 고정
    await tx.announcement.deleteMany();
    await tx.announcement.create({
      data: {
        title: "WooAhJae 이용 안내 (필독)",
        body: usageNoticeBody,
        pinned: true,
        createdBy: admin.id,
      },
    });

    // 4) 프로젝트 예시 생성
    for (const sample of projectSamples) {
      await tx.project.create({
        data: {
          ownerId: ownerCandidate.id,
          title: sample.title,
          summary: sample.summary,
          description: sample.description,
          tab: sample.tab,
          channel: sample.channel,
          capacity: sample.capacity,
          requirements: sample.requirements,
          rolesNeeded: sample.rolesNeeded,
          status: ProjectStatus.OPEN,
          popularityScore: 100,
          likeCount: 10,
          commentCount: 2,
        },
      });
    }

    // 5) 커뮤니티 게시판 예시글 생성(학습+입시/이야기)
    const channels = await tx.boardChannel.findMany({
      where: { slug: { in: ["study-admission", "talk"] } },
      select: { id: true, slug: true, name: true },
    });

    for (const channel of channels) {
      const samples = boardSamples[channel.slug] ?? [];
      for (const item of samples) {
        await tx.boardPost.create({
          data: {
            boardChannelId: channel.id,
            authorId: admin.id,
            categoryTag: item.categoryTag,
            title: item.title,
            content: item.content,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            viewCount: item.viewCount,
            isNotice: false,
            isPinned: false,
          },
        });
      }
    }

    // 6) admissions 공지 + 각 보드 예시 1개씩
    const admissionsNotice = await tx.boardChannel.findFirst({
      where: { communityKey: "admissions", isNotice: true },
      select: { id: true },
    });
    if (admissionsNotice) {
      await tx.boardPost.create({
        data: {
          boardChannelId: admissionsNotice.id,
          authorId: admin.id,
          categoryTag: "공지",
          title: "WooAhJae 이용 안내 (필독)",
          content: usageNoticeBody,
          isNotice: true,
          isPinned: true,
          likeCount: 0,
          commentCount: 0,
          viewCount: 0,
        },
      });
    }

    const admissionsBoards = await tx.boardChannel.findMany({
      where: {
        communityKey: "admissions",
        isNotice: false,
      },
      select: { id: true, slug: true, name: true },
    });
    for (const board of admissionsBoards) {
      const title = admissionsSampleBySlug[board.slug] ?? `${board.name} 예시 글`;
      await tx.boardPost.create({
        data: {
          boardChannelId: board.id,
          authorId: admin.id,
          categoryTag: "정보",
          title,
          content: `${board.name} 게시판 성격에 맞는 안내/정보 예시글입니다. 베타 테스트용으로 제공됩니다.`,
          likeCount: 2,
          commentCount: 0,
          viewCount: 15,
        },
      });
    }
  });
}

prepareBetaContent()
  .then(async () => {
    console.log("✅ Beta content prepared: projects, boards, announcement reset completed.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Failed to prepare beta content:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
