import { prisma } from "@/lib/prisma";
import { BOARD_CHANNELS } from "@/lib/board-config";
import {
  ADMISSIONS_COMMUNITY_KEY,
  ADMISSIONS_GROUPS,
  ADMISSIONS_NOTICE_BOARD,
} from "@/lib/admissions-community-config";

export async function ensureBoardChannels() {
  await Promise.all([
    ...BOARD_CHANNELS.map((item) =>
      prisma.boardChannel.upsert({
        where: { slug: item.slug },
        update: {
          communityKey: item.communityKey,
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
          isNotice: false,
          groupId: null,
        },
        create: {
          communityKey: item.communityKey,
          slug: item.slug,
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
          isNotice: false,
        },
      })
    ),
    prisma.boardChannel.upsert({
      where: { slug: ADMISSIONS_NOTICE_BOARD.slug },
      update: {
        communityKey: ADMISSIONS_COMMUNITY_KEY,
        name: ADMISSIONS_NOTICE_BOARD.name,
        description: "입시 공지와 운영 공지를 확인하는 게시판",
        sortOrder: ADMISSIONS_NOTICE_BOARD.sortOrder,
        isNotice: ADMISSIONS_NOTICE_BOARD.isNotice,
        groupId: null,
      },
      create: {
        communityKey: ADMISSIONS_COMMUNITY_KEY,
        slug: ADMISSIONS_NOTICE_BOARD.slug,
        name: ADMISSIONS_NOTICE_BOARD.name,
        description: "입시 공지와 운영 공지를 확인하는 게시판",
        sortOrder: ADMISSIONS_NOTICE_BOARD.sortOrder,
        isNotice: ADMISSIONS_NOTICE_BOARD.isNotice,
      },
    }),
  ]);

  for (const group of ADMISSIONS_GROUPS) {
    const upsertedGroup = await prisma.boardGroup.upsert({
      where: {
        communityKey_name: {
          communityKey: ADMISSIONS_COMMUNITY_KEY,
          name: group.name,
        },
      },
      update: {
        sortOrder: group.sortOrder,
      },
      create: {
        communityKey: ADMISSIONS_COMMUNITY_KEY,
        name: group.name,
        sortOrder: group.sortOrder,
      },
      select: { id: true },
    });

    await Promise.all(
      group.boards.map((item) =>
        prisma.boardChannel.upsert({
          where: { slug: item.slug },
          update: {
            communityKey: ADMISSIONS_COMMUNITY_KEY,
            groupId: upsertedGroup.id,
            name: item.name,
            description: `${item.name} 게시판`,
            sortOrder: item.sortOrder,
            isNotice: false,
          },
          create: {
            communityKey: ADMISSIONS_COMMUNITY_KEY,
            groupId: upsertedGroup.id,
            slug: item.slug,
            name: item.name,
            description: `${item.name} 게시판`,
            sortOrder: item.sortOrder,
            isNotice: false,
          },
        })
      )
    );
  }

  // Safety: remove any accidental hierarchy marker usage.
  await prisma.boardChannel.updateMany({
    where: { communityKey: ADMISSIONS_COMMUNITY_KEY, isNotice: false, groupId: null },
    data: { sortOrder: 999 },
  });
}

export async function listAdmissionsSidebar() {
  await ensureBoardChannels();

  const [noticeBoard, groups] = await Promise.all([
    prisma.boardChannel.findFirst({
      where: { communityKey: ADMISSIONS_COMMUNITY_KEY, isNotice: true },
      select: { id: true, slug: true, name: true },
    }),
    prisma.boardGroup.findMany({
      where: { communityKey: ADMISSIONS_COMMUNITY_KEY },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    }),
  ]);

  const boards = await prisma.boardChannel.findMany({
    where: { communityKey: ADMISSIONS_COMMUNITY_KEY, isNotice: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      sortOrder: true,
      groupId: true,
    },
  });

  const boardsByGroup = new Map<string, typeof boards>();
  for (const board of boards) {
    if (!board.groupId) continue;
    const prev = boardsByGroup.get(board.groupId) ?? [];
    prev.push(board);
    boardsByGroup.set(board.groupId, prev);
  }

  return {
    noticeBoard,
    groups: groups.map((group) => ({
      ...group,
      boards: boardsByGroup.get(group.id) ?? [],
    })),
  };
}
