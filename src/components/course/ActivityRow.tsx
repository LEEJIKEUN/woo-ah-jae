import Link from "next/link";
import { Clock } from "lucide-react";
import type { Activity } from "@/lib/course/content";
import { courseActivityHref } from "@/lib/course/content";
import { IB } from "@/lib/course/theme";
import { ActivityIconChip } from "./activity-icon";
import DoneBadge from "./DoneBadge";

/** 활동 행 — 아이콘 칩 + 제목 링크 + (포럼 unread pill) + 완료 배지. */
export default function ActivityRow({ courseId, activity }: { courseId: string; activity: Activity }) {
  return (
    <div className="flex items-center gap-3 border-b py-3 last:border-b-0" style={{ borderColor: "#EEF0F3" }}>
      <ActivityIconChip kind={activity.kind} />
      <div className="min-w-0 flex-1">
        <Link
          href={courseActivityHref(courseId, activity.id)}
          className="text-[15.5px] font-medium hover:underline"
          style={{ color: IB.navy }}
        >
          {activity.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]" style={{ color: IB.muted }}>
          {activity.durationMin ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {activity.durationMin}분
            </span>
          ) : null}
          {activity.summary ? <span>{activity.summary}</span> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {activity.kind === "forum" && activity.forumMeta && activity.forumMeta.unread > 0 ? (
          <span
            className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-white"
            style={{ background: IB.darkPill }}
          >
            새 글 {activity.forumMeta.unread}
          </span>
        ) : null}
        <DoneBadge activityId={activity.id} mode={activity.completion} />
      </div>
    </div>
  );
}
