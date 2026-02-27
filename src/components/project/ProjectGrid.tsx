import { ProjectListItem } from "@/lib/project-list-item";
import ProjectCard from "@/components/project/ProjectCard";

type Props = {
  projects: ProjectListItem[];
};

export default function ProjectGrid({ projects }: Props) {
  if (!projects.length) {
    return <div className="py-10 text-center text-sm text-slate-400">조건에 맞는 프로젝트가 없습니다.</div>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
