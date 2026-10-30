#!/usr/bin/env bash
# Upgrade a seeded database from a base ref (default origin/master) to this
# checkout. AutoMigrate never drops columns, so a fresh schema hides changes
# that only break an existing database. The base writes data; this checkout
# migrates it, reads every account back, and seeds a new account on top.
# Then the upgraded schema must match a fresh migration of this checkout.
set -euo pipefail
cd "$(dirname "$0")/.."
base=${1:-origin/master}
work=$(mktemp -d)
container=
cleanup() {
  git worktree remove --force "$work/base" >/dev/null 2>&1 || true
  if [ -n "$container" ]; then docker rm -f "$container" >/dev/null; fi
  rm -rf "$work"
}
trap cleanup EXIT
git worktree add --detach --quiet "$work/base" "$base"
container=$(docker run -d -e POSTGRES_PASSWORD=check -e POSTGRES_DB=upgrade -p 127.0.0.1::5432 postgres:18-alpine)
port=$(docker port "$container" 5432/tcp | head -n 1 | sed 's/.*://')
# The image's init server listens on a socket only, so TCP readiness means the real server.
until docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d upgrade >/dev/null 2>&1; do sleep 1; done
export DATABASE_URL="postgres://postgres:check@127.0.0.1:$port/upgrade?sslmode=disable"
# Any development key passes the seed's live-instance guard; nothing calls Clerk.
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_c21va2UuY2xlcmsuYWNjb3VudHMuZGV2JA

echo "[migration-check] $base: migrate and seed"
(cd "$work/base/backend" && go run ./cmd/migrate)
if [ -d "$work/base/backend/cmd/seed" ]; then
  (cd "$work/base/backend" && go run ./cmd/seed --subject=upgrade-existing)
else
  echo "[migration-check] $base has no seed command; checking the schema upgrade only"
fi
echo "[migration-check] this checkout: migrate, read every account back, seed a new one"
(cd backend && go run ./cmd/migrate && go run ./cmd/seed --all-accounts && go run ./cmd/seed --subject=upgrade-new)

echo "[migration-check] compare the upgraded schema with a fresh one"
docker exec "$container" createdb -U postgres fresh
(cd backend && DATABASE_URL="postgres://postgres:check@127.0.0.1:$port/fresh?sslmode=disable" go run ./cmd/migrate)
# Approved raw SQL breakglass: GORM cannot list a whole schema. Column order is
# left out because AutoMigrate appends new columns.
schema() {
  docker exec "$container" psql -U postgres -d "$1" -At -F ' | ' \
    -c "SELECT table_name, column_name, data_type, is_nullable, coalesce(column_default, '') FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1, 2" \
    -c "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2"
}
if ! diff -u --label upgraded --label fresh <(schema upgrade) <(schema fresh); then
  echo "[migration-check] the upgraded schema differs from a fresh one (- upgraded, + fresh)." >&2
  echo "[migration-check] AutoMigrate keeps removed columns, never tightens NOT NULL and keeps changed indexes; add a repeatable GORM fix to postgres.Migrate." >&2
  exit 1
fi
echo "[migration-check] upgrade from $base passed"
