import { FileText, Folder, MessageSquare, ClipboardList, BookOpen } from "lucide-react";
import type { ActivityKind } from "@/lib/course/content";
import { IB } from "@/lib/course/theme";

/** 활동 유형별 아이콘 칩 색/아이콘 — 레퍼런스의 32×32 틴트 칩. */
export function ActivityIconChip({ kind, size = 32 }: { kind: ActivityKind; size?: number }) {
  const map = {
    page: { Icon: BookOpen, tint: IB.tintViolet, color: "#3F37C9" },
    resource: { Icon: FileText, tint: IB.tintViolet, color: "#3F37C9" },
    folder: { Icon: Folder, tint: IB.tintTeal, color: "#157A6E" },
    forum: { Icon: MessageSquare, tint: IB.tintTeal, color: "#157A6E" },
    assignment: { Icon: ClipboardList, tint: IB.tintAmber, color: "#A8804A" },
  } as const;
  const { Icon, tint, color } = map[kind];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[6px]"
      style={{ width: size, height: size, background: tint, color }}
    >
      <Icon size={size * 0.55} />
    </span>
  );
}
