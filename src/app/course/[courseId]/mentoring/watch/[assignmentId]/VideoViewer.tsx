"use client";

/**
 * 동영상 전용 뷰어 — 새 탭에서 화면 전체를 덮어(사이트 헤더 없이) 재생.
 * ⋮ 메뉴의 기능(재생 속도·PIP·전송)은 유지하고 다운로드만 제거(controlsList="nodownload").
 */
export default function VideoViewer({ src, name }: { src: string; name: string }) {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-4 bg-black px-4 py-6">
      <p className="max-w-full truncate text-[13px] text-white/70" title={name}>{name}</p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={src}
        controls
        autoPlay
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="max-h-[88vh] w-full max-w-5xl rounded-lg bg-black"
      >
        브라우저가 동영상 재생을 지원하지 않습니다.
      </video>
    </div>
  );
}
