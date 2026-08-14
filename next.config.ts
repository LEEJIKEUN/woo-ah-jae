import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 전용 무거운 의존성은 번들에 넣지 않고 런타임 require(빌드 메모리·번들 이슈 방지)
  serverExternalPackages: ["pdf-lib"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "cdn.wooahjae.com",
      },
    ],
  },
};

export default nextConfig;
