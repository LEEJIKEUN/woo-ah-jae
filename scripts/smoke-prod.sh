#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://wooahjae.com}"

printf "[1/4] Health check: %s/login\n" "$BASE_URL"
curl -fsS "$BASE_URL/login" >/dev/null

printf "[2/4] Forgot password endpoint smoke (non-existing email)\n"
curl -fsS -X POST "$BASE_URL/api/auth/forgot-password" \
  -H 'content-type: application/json' \
  -d '{"email":"not-found-user@example.com"}' >/dev/null

printf "[3/4] Category page check\n"
curl -fsS "$BASE_URL/category" >/dev/null

printf "[4/4] Projects page check\n"
curl -fsS "$BASE_URL/projects" >/dev/null

echo "SMOKE OK: $BASE_URL"
