FROM node:20-bookworm-slim AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --verbose || (ls -al /root/.npm/_logs && cat /root/.npm/_logs/*.log && false)

COPY . .
RUN npm run db:generate && npm run build:render

EXPOSE 10000
CMD ["sh", "-c", "npm run ops:check && node scripts/prepare-db.mjs && npm run ops:guard:prod-data && npm run db:seed:if-empty && npm run start -- -p ${PORT:-10000}"]
