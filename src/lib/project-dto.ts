import { ApplicationStatus, Project, ProjectStatus, StudentProfile, User } from "@prisma/client";

export type ProjectCardItem = {
  id: string;
  title: string;
  summary: string;
  tab: string;
  channel: string;
  thumbnailUrl: string | null;
  popularityScore: number;
  likeCount: number;
  commentCount: number;
  status: "open" | "closed";
  capacity: number;
  requirements: string;
  targetRoles: string;
  deadline?: string;
  gradeBand?: string;
  createdAt: string;
};

export function toCardItem(project: Project): ProjectCardItem {
  return {
    id: project.id,
    title: project.title,
    summary: project.summary ?? project.description.slice(0, 120),
    tab: project.tab ?? "교과",
    channel: project.channel ?? "전체",
    thumbnailUrl: project.thumbnailUrl ?? null,
    popularityScore: project.popularityScore,
    likeCount: project.likeCount,
    commentCount: project.commentCount,
    status: project.status === ProjectStatus.OPEN ? "open" : "closed",
    capacity: project.capacity,
    requirements: project.requirements ?? "없음",
    targetRoles: project.rolesNeeded ?? "협업 가능한 학생",
    deadline: project.deadline?.toISOString().slice(0, 10),
    createdAt: project.createdAt.toISOString(),
  };
}

export type ApplicationListItem = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  applicantIntro: string;
  contact: string;
  answer1: string;
  answer2: string;
  answer3: string;
  applicant: {
    id: string;
    email: string;
    name: string;
    school: string;
    grade: string;
  };
};

export function formatApplicantLabel(
  user: Pick<User, "email"> & { studentProfile: Pick<StudentProfile, "realName" | "schoolName" | "grade"> | null }
) {
  const name = user.studentProfile?.realName ?? user.email.split("@")[0];
  const school = user.studentProfile?.schoolName ?? "학교미입력";
  const grade = user.studentProfile?.grade ?? "학년미입력";
  return { name, school, grade };
}
