DURATION ?= 45
LEVEL ?= 2
export GOTOOLCHAIN := go1.27.1
VERSION ?= dev
REVISION := $(shell git rev-parse --short HEAD)
API_PACKAGE := github.com/epicchewy/endorphins/backend/internal/app
NODE_VERSION := $(shell cat .nvmrc)
GOLANGCI := go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.14.0
CLERK_APP := app_3K5z4w8PFdIMSXl1sR7bXIDV6EV
# Use nvm's copy of the pinned Node when it is installed, so no target needs `nvm use`.
NVM_NODE_BIN := $(wildcard $(or $(NVM_DIR),$(HOME)/.nvm)/versions/node/v$(NODE_VERSION)/bin)
ifneq ($(NVM_NODE_BIN),)
export PATH := $(NVM_NODE_BIN):$(PATH)
endif

.PHONY: workout
workout:
	@bash build/update.sh
	$(eval ID = $(shell ls -1 ./workouts | wc -l ))
	@python3 main.py $(DURATION) $(LEVEL) $(ID)
	@echo "Opening today's workout pdf"
	@bash build/open.sh

.PHONY: install
install:
	@bash build/install.sh

# Full-stack app. The original Python targets above remain available.
.PHONY: node-version setup dev api web check test lint build format
# Another Node on PATH breaks Vite and the e2e harness in confusing ways.
node-version:
	@test "$$(node --version)" = "v$(NODE_VERSION)" || { echo "Found Node $$(node --version); .nvmrc pins v$(NODE_VERSION). Run 'nvm install' (Make then uses it), or prefix the command with: npx --yes --package=node@$(NODE_VERSION) --" >&2; exit 1; }

setup: node-version
	cd backend && go mod download
	cd frontend && bun install --frozen-lockfile
	cd e2e && bun install --frozen-lockfile

# Clerk development keys, pulled once per checkout. Needs the Clerk CLI and `clerk auth login`.
frontend/.env.local:
	cd frontend && clerk env pull --app $(CLERK_APP) --file .env.local || { echo 'Could not pull Clerk keys. Run: npm install -g clerk && clerk auth login, then retry.' >&2; exit 1; }

dev: setup frontend/.env.local db-up migrate
	bash scripts/dev.sh

api: frontend/.env.local
	cd backend && bun --env-file=../.env.example --env-file=../frontend/.env.local run --no-orphans go run ./cmd/api

web: node-version frontend/.env.local
	cd frontend && bun run dev

format: node-version
	cd backend && $(GOLANGCI) fmt
	cd frontend && bun run format
	cd frontend && bunx prettier --write ../e2e --ignore-path ../.gitignore

test:
	cd backend && go test -race -tags integration ./...
	cd frontend && bun test test

lint: node-version
	python3 scripts/check-layers.py
	cd backend && $(GOLANGCI) run
	cd backend && $(GOLANGCI) run --build-tags=integration,e2e
	cd frontend && bun run lint && bun run format:check
	cd e2e && bun run typecheck
	cd frontend && bunx prettier --check ../e2e --ignore-path ../.gitignore

build: node-version
	cd backend && go build -ldflags "-X $(API_PACKAGE).Version=$(VERSION) -X $(API_PACKAGE).Revision=$(REVISION)" -o bin/api ./cmd/api
	cd frontend && bun run build && bun scripts/check-release.ts

check: lint test
	cd frontend && bun run typegen && bun run typecheck
	$(MAKE) build

.PHONY: e2e smoke browsers
e2e: node-version
	cd e2e && bun run test

smoke: e2e

# Real Clerk sign-up and sign-in against `make dev` (started if not running), or a
# preview with URL=https://... Creates and deletes Clerk test users.
.PHONY: e2e-clerk
e2e-clerk: node-version frontend/.env.local
	cd e2e && $(if $(URL),PLAYWRIGHT_TEST_BASE_URL=$(URL)) bun --env-file=../frontend/.env.local run playwright test -c clerk/playwright.config.ts

browsers: node-version
	cd e2e && bunx playwright install chromium

.PHONY: db-up db-stop migrate seed migration-check
db-up:
	docker compose up -d --wait postgres

db-stop:
	docker compose stop postgres

migrate:
	cd backend && bun --env-file=../.env.example --env-file=../frontend/.env.local run go run ./cmd/migrate

# Five weeks of plans and completions. SUBJECT=user_... seeds that Clerk user;
# without it, every local account that has no saved plans is seeded.
seed: frontend/.env.local
	cd backend && bun --env-file=../.env.example --env-file=../frontend/.env.local run go run ./cmd/seed $(if $(SUBJECT),--subject=$(SUBJECT),--all-accounts)

# Upgrade a seeded database from BASE to this checkout, then read it back.
BASE ?= origin/master
migration-check:
	bash scripts/migration-check.sh $(BASE)
