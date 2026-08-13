"use client";

/** 다운로드 메뉴가 없는 동영상 뷰어 — 새 탭에서 재생만 허용. */
export default function VideoViewer({ src, name }: { src: string; name: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 py-8">
      <p className="max-w-full truncate text-[13px] text-white/70" title={name}>{name}</p>
      <video
        src={src}
        controls
        autoPlay
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        className="max-h-[85vh] w-full max-w-4xl rounded-lg bg-black"
      >
        브라우저가 동영상 재생을 지원하지 않습니다.
      </video>
    </main>
  );
}
