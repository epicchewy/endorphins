DURATION ?= 45
LEVEL ?= 2
export GOTOOLCHAIN := go1.27.1
VERSION ?= dev
REVISION := $(shell git rev-parse --short HEAD)
API_PACKAGE := github.com/epicchewy/endorphins/backend/internal/app

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
.PHONY: setup dev api web check test lint build format
setup:
	cd backend && go mod download
	cd frontend && bun install --frozen-lockfile
	cd e2e && bun install --frozen-lockfile

dev: db-up migrate
	bash scripts/dev.sh

api:
	cd backend && bun --env-file=../.env.example --env-file=../frontend/.env.local run --no-orphans go run ./cmd/api

web:
	cd frontend && bun run dev

format:
	cd backend && gofmt -w .
	cd frontend && bun run format
	cd frontend && bunx prettier --write ../e2e --ignore-path ../.gitignore

test:
	cd backend && go test -race -tags integration ./...
	cd frontend && bun test test

lint:
	@test -z "$$(cd backend && gofmt -l .)" || (echo 'Run make format'; exit 1)
	python3 scripts/check-layers.py
	cd backend && GOTOOLCHAIN=go1.27.1 go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.14.0 run
	cd backend && GOTOOLCHAIN=go1.27.1 go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.14.0 run --build-tags=integration,e2e
	cd frontend && bun run lint && bun run format:check
	cd e2e && bun run typecheck
	cd frontend && bunx prettier --check ../e2e --ignore-path ../.gitignore

build:
	cd backend && go build -ldflags "-X $(API_PACKAGE).Version=$(VERSION) -X $(API_PACKAGE).Revision=$(REVISION)" -o bin/api ./cmd/api
	cd frontend && bun run build && bun scripts/check-release.ts

check: lint test
	cd frontend && bun run typegen && bun run typecheck
	$(MAKE) build

.PHONY: e2e smoke browsers
e2e:
	cd e2e && bun run test

smoke: e2e

browsers:
	cd e2e && bunx playwright install chromium

.PHONY: db-up db-stop migrate
db-up:
	docker compose up -d --wait postgres

db-stop:
	docker compose stop postgres

migrate:
	cd backend && bun --env-file=../.env.example --env-file=../frontend/.env.local run go run ./cmd/migrate
