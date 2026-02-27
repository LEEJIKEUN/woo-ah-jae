import { UserRole } from "@prisma/client";
import { HttpError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export async function requireTeamMember(projectId: string, userId: string, role?: UserRole) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  if (role === UserRole.ADMIN) {
    return { projectId: project.id, isOwner: false, isAdmin: true };
  }

  if (project.ownerId === userId) {
    return { projectId: project.id, isOwner: true, isAdmin: false };
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });

  if (!member) {
    throw new HttpError(403, "Team members only");
  }

  return { projectId: project.id, isOwner: false, isAdmin: false };
}

export async function requireWorkspaceManager(projectId: string, userId: string, role?: UserRole) {
  if (role === UserRole.ADMIN) {
    return { projectId, canManage: true };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  if (project.ownerId !== userId) {
    throw new HttpError(403, "Workspace manager only");
  }
  return { projectId, canManage: true };
}
