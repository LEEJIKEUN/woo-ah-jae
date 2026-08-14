FROM node:20-bookworm-slim AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# npm 11로 업데이트 (npm ci 호환성 문제 방지)
RUN npm install -g npm@11

COPY package.json package-lock.json ./
RUN set -e; \
    npm ci --verbose || { \
      ls -al /root/.npm/_logs || true; \
      find /root/.npm/_logs -maxdepth 1 -type f -print -exec cat {} \; || true; \
      exit 1; \
    }

COPY . .
# 빌드 중 메모리 여유 확보(Next/webpack 대형 빌드 OOM 방지) — 빌드 단계에만 적용
RUN NODE_OPTIONS="--max-old-space-size=4096" sh -c "npm run db:generate && npm run build:render"

EXPOSE 10000
CMD ["node", "scripts/startup.mjs"]
