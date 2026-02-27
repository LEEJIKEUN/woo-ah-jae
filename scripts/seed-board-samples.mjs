import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BOARD_THEMES = {
  "study-admission": { name: "학습+입시 정보 공유", focus: "학습법과 전형 준비 전략" },
  talk: { name: "이야기 나눠요", focus: "학생 일상과 커뮤니티 소통" },
  "special-eligibility-prep": { name: "특례 자격조건 및 준비", focus: "지원 자격과 서류 준비" },
  "education-admission-news": { name: "교육 및 입시 관련 소식", focus: "최신 정책과 전형 공지" },
  "overseas-korean-special": { name: "재외국민 특례", focus: "재외국민 전형 준비" },
  "special-math": { name: "특례 수학", focus: "수학 기출 분석과 풀이 전략" },
  "special-korean": { name: "특례 국어", focus: "국어 독해와 논술 대비" },
  "special-english": { name: "특례 영어", focus: "영어 독해와 에세이 대비" },
  "foreign-university-track": { name: "외국대 전형", focus: "해외 대학 지원 전략" },
  "early-special-talent": { name: "수시 및 특기자", focus: "수시/특기자 포트폴리오 준비" },
  "korean-curriculum": { name: "한국교육과정", focus: "국내 교육과정 학습 운영" },
  "sat-act": { name: "SAT, ACT", focus: "SAT/ACT 점수 향상 전략" },
  "ibt-toeic-teps": { name: "iBT, TOEIC, TEPS", focus: "영어 공인시험 점수 관리" },
  ib: { name: "IB", focus: "IB 과목별 평가 대비" },
  ap: { name: "AP", focus: "AP 과목 선택과 시험 대비" },
  "a-level": { name: "A-level", focus: "A-level 과목별 준비 루틴" },
};

const CATEGORIES = ["정보", "질문", "자료", "후기", "토론"];

function buildFivePosts(theme) {
  return [
    {
      categoryTag: CATEGORIES[0],
      title: `${theme.name} 시작 전 체크리스트`,
      content: `${theme.focus} 관점에서 필수 일정, 문서, 준비 항목을 한 번에 정리했습니다. 팀별로 수정해 사용해도 됩니다.`,
    },
    {
      categoryTag: CATEGORIES[1],
      title: `${theme.name} 준비하면서 가장 막히는 지점`,
      content: `${theme.focus} 준비 중 실제로 많이 막히는 구간을 질문으로 모았습니다. 본인 경험을 댓글로 공유해주세요.`,
    },
    {
      categoryTag: CATEGORIES[2],
      title: `${theme.name} 주간 학습 플래너 템플릿 공유`,
      content: `${theme.focus}에 맞춘 4주 템플릿입니다. 목표/복습/오답 루틴을 넣어 바로 사용할 수 있도록 구성했습니다.`,
    },
    {
      categoryTag: CATEGORIES[3],
      title: `${theme.name} 실전 적용 후기`,
      content: `${theme.focus} 전략을 2주 적용한 뒤 바뀐 점을 기록했습니다. 시간 배분과 우선순위 조정 팁을 함께 남깁니다.`,
    },
    {
      categoryTag: CATEGORIES[4],
      title: `${theme.name} 다음 스터디 주제 제안`,
      content: `${theme.focus} 범위에서 다음 주에 다루면 좋은 주제를 모아봅시다. 필요한 자료가 있다면 같이 요청해주세요.`,
    },
  ];
}

async function main() {
  const candidateUsers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STUDENT"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    take: 10,
    select: { id: true, role: true },
  });

  if (candidateUsers.length === 0) {
    throw new Error("사용자 계정이 없어 샘플 게시글 작성자를 찾을 수 없습니다.");
  }

  const boards = await prisma.boardChannel.findMany({
    where: {
      slug: { in: Object.keys(BOARD_THEMES) },
      isNotice: false,
    },
    select: { id: true, slug: true, name: true },
    orderBy: [{ communityKey: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (boards.length === 0) {
    throw new Error("샘플 게시글을 넣을 보드를 찾지 못했습니다.");
  }

  let createdOrUpdated = 0;

  for (const board of boards) {
    const theme = BOARD_THEMES[board.slug] ?? { name: board.name, focus: `${board.name} 학습 및 정보 공유` };
    const posts = buildFivePosts(theme);

    for (let i = 0; i < posts.length; i += 1) {
      const post = posts[i];
      const author = candidateUsers[i % candidateUsers.length];
      const seededId = `sample-${board.slug}-${i + 1}`;
      const createdAt = new Date(Date.now() - (i + 1) * 1000 * 60 * 60 * 10);

      await prisma.boardPost.upsert({
        where: { id: seededId },
        update: {
          boardChannelId: board.id,
          authorId: author.id,
          categoryTag: post.categoryTag,
          title: post.title,
          content: post.content,
          status: "ACTIVE",
          isNotice: false,
          isPinned: false,
          viewCount: 10 + i * 3,
          likeCount: 2 + i,
          commentCount: i % 3,
        },
        create: {
          id: seededId,
          boardChannelId: board.id,
          authorId: author.id,
          categoryTag: post.categoryTag,
          title: post.title,
          content: post.content,
          status: "ACTIVE",
          isNotice: false,
          isPinned: false,
          viewCount: 10 + i * 3,
          likeCount: 2 + i,
          commentCount: i % 3,
          createdAt,
          updatedAt: createdAt,
        },
      });

      createdOrUpdated += 1;
    }
  }

  console.log(`샘플 게시글 시드 완료: ${boards.length}개 보드, 총 ${createdOrUpdated}개 upsert`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

