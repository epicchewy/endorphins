#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d frontend/node_modules ]; then
  printf '%s\n' 'Install dependencies first with make setup.' >&2
  exit 1
fi
# Build first so the supervised process is the API itself, not a go run wrapper.
(cd backend && go build -o bin/api ./cmd/api)
(cd frontend && exec bun run dev-backend.ts ./bin/api) &
api_pid=$!
(cd frontend && exec node ./node_modules/vite/bin/vite.js) &
web_pid=$!
cleanup() {
  kill "$api_pid" "$web_pid" 2>/dev/null || true
  wait "$api_pid" "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Compatible with the macOS system Bash (which has no wait -n).
while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
  sleep 1
done
printf '%s\n' 'A development server stopped; shutting down the other server.' >&2
exit 1
