# Shift testing left

Decided October 21, 2026. The goal is fast, responsible iteration. Production deployment is out of scope.

## Starting point

- Go tests use real Postgres through Testcontainers. Playwright runs desktop and mobile journeys against disposable containers. A separate live suite covers real Clerk sign-up and sessions. CI took about six minutes.
- There was no deployed environment, so reviewers could only run a branch locally.
- New local accounts started empty. Reviewers had to create plans and completions by hand.
- No test upgraded an existing database. `AutoMigrate` adds columns and never drops them. A new `NOT NULL` column without a default, or a removed required field, breaks only a populated database. Fresh-database tests pass in both cases.

## Research

The first pass used web search because Exa was not connected. A second pass with Exa on the same day confirmed the design and corrected three facts; see [What the Exa research changed](#what-the-exa-research-changed).

### Preview environments

- Railway PR environments copy the base environment's services, networking and variables, with fresh databases and new URLs. Railway deletes them when the PR merges or closes, and deploys PRs only from workspace members. [1] [2]
- A new PR database is empty. Railway staff recommend a seed script. [3] One Railway comparison post says previews include seed data [4]; the docs and support answers do not agree, so the seed is ours to write.
- A pre-deploy command runs in its own container on the private network, with the service variables. A failure stops the deploy and is not retried. There is no timeout by default. [5] Public projects use the same migrate-then-idempotent-seed step. [6]
- Railway's own guidance says ephemeral environments do not test migrations against realistic data; that needs a separate process. [2]
- Small teams report the same shape. MasterBoard seeds each PR database with six months of data and shares one URL with testers. [7] Felt seeds several account types per PR and posts one-click login links on the PR, and notes that seed data needs upkeep with every feature. [8]
- Railway reads `railway.json` until 2026-12-01, and new projects cannot use it after 2026-08-28. `.railway/railway.ts` is generally available, and only `railway config apply` applies it. [9] [10]

### Identity

- Clerk accepts host preview domains only with development keys. Development instances hold 100 users. [11]
- `+clerk_test` addresses verify with code `424242` on development instances. Testing Tokens bypass bot checks. [12]
- Clerk Agent Tasks (beta) return a URL that signs in a chosen user, for end-to-end tests and agents. The redirect must use one of the instance's domains. [13]

### Migrations and seed data

- `AutoMigrate` never drops unused columns. [14] In the pinned GORM v1.31.2 it relaxes `NOT NULL` but never tightens a nullable column by itself (`migrator/migrator.go`, `MigrateColumn`). A fresh database and an upgraded one can then disagree.
- Atlas has an official GORM provider for versioned migrations [14]; its lint needs Atlas Pro from v0.38. [15]
- Snaplet wound down in 2024. Its seed tool is community-maintained with occasional fixes. [16] Supabase and Neon previews also start empty or schema-only and rely on seed files or masked branches. [16] [17]

### Test agents

- Playwright 1.56 added planner, generator and healer agents. `npx playwright init-agents --loop=claude` writes their definitions; regenerate them after each Playwright upgrade. [18]
- Practitioner reports agree. The planner explores well and finds real bugs. Generated tests are first drafts: they hard-code content, over-assert, and can encode a known defect as the expected result. The generator always adds new spec files. The healer fixes locators but can make a test agree with a broken app, so every heal needs review. [19] [20] [21]

### Agent workloads and sandboxes

- Railway Sandboxes became generally available on 2026-09-18, on every plan. They are Linux VMs with checkpoints, forks, Docker, preinstalled coding agents and optional private networking. [22] Railway Cloud Agents (`railway ca`) are in beta. [23]
- E2B, Daytona, Modal, Vercel Sandbox and Cloudflare Sandboxes differ in isolation, pause behaviour and session caps. [24] [25] For an app already on Railway, Railway Sandboxes share the bill and the private network.
- River is a Postgres job queue for Go with transactional enqueue, retries and cron jobs. It runs in the existing database. [26]

## Decisions

| Area | Decision | Rejected |
| --- | --- | --- |
| Seed data | `cmd/seed` writes five weeks of plans and completions through the real generator and stores. A GORM session clock backdates them. It refuses non-`pk_test_` Clerk keys and never adds to an account that has plans. | Raw SQL fixtures; reusing the e2e-only fixture package; Snaplet seed |
| Migrations | Keep `AutoMigrate`. `make migration-check` seeds a database with the base commit, migrates it with the branch, reads every account back and seeds a new one. It then compares the upgraded columns and indexes with a fresh migration. CI runs it on PRs and `master`. | Versioned SQL with goose or Atlas: it breaks the raw SQL breakglass and the Temper convention, and Atlas lint is paid |
| Previews | Railway project with `postgres`, `api`, `web` and a `tailnet` forwarder. `production` deploys `master` and is the PR base; there is no staging. The `api` pre-deploy step migrates, then seeds everywhere except `production`. | Vercel or Fly: Railway gives databases, private networking and environments in one place. A persistent staging environment: production already is the long-lived populated database |
| Access | No public domains. Each environment's Tailscale Forwarder serves HTTPS on its `ts.net` name, as Postmaker is reachable only over Tailscale. | A subnet router like Postmaker's: one per tailnet, already taken, and plain HTTP breaks Clerk. Railway Authentication: committed-spend plans only |
| Identity | Reuse the Clerk development instance for local, PR and production environments. A Clerk production instance needs an owned domain, which `ts.net` is not. | A second development instance |
| Realistic flows | `make e2e-clerk URL=...` runs the real-Clerk journeys against any preview. | Running them on every deploy: the deploy event has no URL yet |

The upgrade check was proven against an injected `NOT NULL` column with no default. Postgres rejected it with `column "calories" of relation "workouts" contains null values`. The existing tests passed with the same change.

The drift comparison was added on October 23 after the user approved its one SQL query. It was proven against two more injected changes that migrate without error. Tightening `workouts.input_fingerprint` to `NOT NULL` left the upgraded column nullable, and removing the field left the column in place; the check failed on both. A clean upgrade passes.

## What the Exa research changed

- Railway Sandboxes are generally available, not limited to Priority Boarding. The installed `use-railway` skill still says otherwise; the changelog is newer.
- New Railway projects cannot use Config as Code, so `.railway/railway.ts` is required rather than preferred.
- The first upgrade check missed `AutoMigrate` gaps that raise no error: a column tightened to `NOT NULL` stays nullable, a removed field's column stays, and a changed index keeps its old definition under the same name (`migrator/migrator.go`). The check now compares the upgraded schema with a fresh one.

The design did not change; the upgrade check gained the schema comparison.

## Production behind Tailscale (October 24)

The user dropped staging. The test environments are local, Railway PR previews and a persistent `production`, which stays private over Tailscale like Postmaker.

- Postmaker's Railway project has no public domains and runs `tailscale/tailscale` as a subnet router (`TS_ROUTES`, state on a volume, hostname `<project>-<environment>`). Railway documents that only one subnet router per tailnet can carry its shared private range, so Endorphins uses the per-environment forwarder.
- PR environments copy production's variables, and Railway sets no variable that marks a PR environment. Production therefore keeps `SEED_SUBJECTS` for previews, and the seed skips the environment named `production`. Because production also uses a `pk_test_` key, the key guard alone no longer protects it.
- Railway provisions Postgres 18, and a pin to 17 would have swapped Railway's SSL template for the plain `postgres:17` image on a data folder 18 had created. Everything moved to 18 instead: Railway, `compose.yaml` (a new volume at `/var/lib/postgresql`, which 18 requires), the Go and e2e test containers, and `make migration-check`. Postmaker stays on 17.
- The workspace default region is Singapore. Endorphins runs in `us-east4-eqdc4a`, beside Postmaker. `railway config plan` (CLI 5.71) moves databases and volumes between regions but drops a single-replica service's region change, so the services were moved with the Railway MCP's `update-service`.

## Deferred

- **Pre-deploy timeout.** Set `preDeployTimeoutSeconds` so a migration stuck on a lock fails the deploy instead of holding it.
- **Seeded personas and sign-in links.** Seed several account shapes (new, onboarded with no plans, active) and post Clerk Agent Task links on the PR. First confirm that Agent Task redirects accept the forwarders' `ts.net` names.
- **Production snapshots.** Once production holds real data, restore a snapshot of it into local development and `make migration-check`, as Postmaker's `scripts/dev snapshot` does.
- **Preview e2e on every deploy.** Add it when PR volume justifies a Railway token in CI. Resolve the URL with `railway domain list` or the GraphQL API after the `deployment_status` event.
- **Playwright test agents.** Run the planner against a preview as exploratory testing. Fold reviewed generator output into the existing `e2e/specs` files. Never let the healer commit unreviewed changes.
- **Agent workloads.** For generating personalized workouts with agents: a worker service beside `api` with River jobs in the same Postgres, and Railway Sandboxes for isolated agent runs, with private networking only when a run needs the API or database. Cloud agents can run Claude Code inside the project.
- **Focused PR environments and app sleeping.** Turn these on if preview cost grows. The watch patterns in `.railway/railway.ts` already map services to paths.

## Sources

1. [Railway: preview deployments with PR environments](https://docs.railway.com/guides/preview-deployments-with-pr-environments)
2. [Railway blog: CI/CD from manual deploys to PR environments](https://blog.railway.com/p/cicd-for-modern-deployment-from-manual-deploys-to-pr-environments) (2025-12-02)
3. [Railway Station: pg_dump helper for PR environments](https://station.railway.com/questions/pg-dump-helper-for-pr-environments-cdd4d0b0); [copy volume data removed](https://station.railway.com/questions/copy-volume-data-not-available-anymore-31671c4b)
4. [Railway blog: best preview environment platforms in 2026](https://blog.railway.com/p/best-preview-environment-platforms-2026)
5. [Railway: pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command)
6. [AiSOC `railway.toml`](https://github.com/beenuar/AiSOC/blob/main/infra/railway/railway.toml); [blitzentrapper PR seeding commit](https://github.com/TRMW/blitzentrapper/commit/69a3a7175b110a5d3bcc86aac7c65f9a0af7ee9c)
7. [Prisma: how MasterBoard simplified CI/CD testing](https://www.prisma.io/blog/how-masterboard-simplified-ci-cd-testing-with-prisma-postgres)
8. [Render: how Felt deploys](https://render.com/blog/felt-deploying)
9. [Railway: Infrastructure as Code](https://docs.railway.com/infrastructure-as-code)
10. [Railway changelog 2026-08-20](https://railway.com/changelog/2026-08-20-railway-anon)
11. [Clerk: set up a preview environment](https://clerk.com/docs/deployments/set-up-preview-environment)
12. [Clerk: testing with Playwright](https://clerk.com/docs/guides/development/testing/playwright/overview); [test the sign-up form](https://clerk.com/docs/guides/development/testing/playwright/test-sign-up-flows)
13. [Clerk: Agent Tasks](https://clerk.com/docs/guides/development/testing/agent-tasks)
14. [GORM: migration](https://gorm.io/docs/migration.html)
15. [Atlas: verifying migration safety](https://atlasgo.io/versioned/lint)
16. [Supabase: seeding your database](https://supabase.com/docs/guides/local-development/seeding-your-database)
17. [Neon: branching](https://neon.com/docs/introduction/branching)
18. [Playwright: test agents](https://playwright.dev/docs/test-agents); [v1.56.0 release](https://github.com/microsoft/playwright/releases/tag/v1.56.0)
19. [Fahriddin Salaydinov: Playwright test agents on a real site](https://fahriddin.com/writing/playwright-test-agents-real-codebase) (2026-10-13)
20. [Ben Weese: building Playwright agents](https://benweese.com/building-playwright-agents-lessons-from-the-deep-trenches/) (2026-05-11)
21. [Gary Parker: hands-on with Playwright test agents](https://garyparker.dev/blog/hands-on-with-playwright-test-agents) (2026-07-29)
22. [Railway changelog: Sandboxes generally available](https://railway.com/changelog/2026-09-18-railway-sandboxes) (2026-09-18)
23. [Railway changelog: Cloud Agents beta](https://railway.com/changelog/agents-android-autopatch.md)
24. [Upstash: AI agent sandboxes compared](https://upstash.com/blog/ai-agent-sandbox-providers-compared-2026) (2026-09-17)
25. [Fly.io: agent sandbox providers](https://fly.io/learn/agent-sandbox-providers/) (2026-09-09)
26. [River: transactional enqueueing](https://riverqueue.com/docs/transactional-enqueueing)
