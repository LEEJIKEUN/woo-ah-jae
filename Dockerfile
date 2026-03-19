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
RUN npm run db:generate && npm run build:render

EXPOSE 10000
CMD ["sh", "-c", "npm run ops:check && node scripts/prepare-db.mjs && npm run db:seed:if-empty && npm run ops:guard:prod-data && npm run start -- -p ${PORT:-10000}"]
