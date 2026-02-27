import Link from "next/link";

type TopPost = {
  id: string;
  title: string;
  likeCount: number;
  commentCount: number;
};

type Props = {
  topPosts: TopPost[];
};

export default function BrandIntro({ topPosts }: Props) {
  return (
    <section className="relative flex min-h-[320px] items-start overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 px-6 py-6 backdrop-blur-sm md:h-[58vh] md:max-h-[560px] md:px-10 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(148,163,184,0.16),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(30,58,138,0.2),transparent_40%)]" />
      <div className="relative max-w-4xl space-y-5">
        <p className="leading-tight text-2xl font-extrabold tracking-tight text-[color:var(--primary)] md:text-4xl">
          <span className="block">우리만 아는 재외국민특별전형</span>
          <span className="block">(WOO AH JAE)</span>
        </p>
        <h1 className="text-xl font-bold leading-tight tracking-tight text-[color:var(--primary)] md:text-3xl md:leading-tight">
          <span className="block">함께 연구하고 성장하는</span>
          <span className="block">프로젝트 커뮤니티</span>
        </h1>
        <p className="text-sm leading-7 text-[color:var(--muted)] md:text-base">
          전 세계 한국학교와 국제학교, 로컬학교 학생들이 팀을 만들어 함께 즐겁게 연구할 수 있는 실명 기반의 안전한 협업공간을 제공합니다.
        </p>
        <div className="space-y-2 pt-1">
          <p className="text-sm font-semibold tracking-wide text-slate-200">TOP5 인기글</p>
          <ul className="space-y-1.5">
            {topPosts.map((post, idx) => (
              <li key={post.id}>
                <Link
                  href={`/boards/posts/${post.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="line-clamp-1">
                    {idx + 1}. {post.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">♥ {post.likeCount} · 댓글 {post.commentCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
