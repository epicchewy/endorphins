# Preview environments

Railway runs a persistent `staging` environment from `master` and a temporary environment for each pull request. Neither is production. Both use the Clerk development instance, because Clerk accepts host preview domains only with development keys.

```text
pull request ─► Railway PR environment (a copy of staging)
                  web  frontend/Dockerfile, public *.up.railway.app domain
                   └─ /api proxy, private network ─► api  backend/Dockerfile
                                                     pre-deploy: migrate, then seed
                                                      └─► postgres (empty for each PR)
```

- [`.railway/railway.ts`](../.railway/railway.ts) defines the services, build settings, health checks and variables. Railway does not read it during deploys. `railway config plan` previews a change and `railway config apply` applies it to the linked environment.
- Railway copies the services and variables of `staging` into each PR environment. Each PR environment starts with an empty Postgres and new database credentials. Railway deletes the environment when the PR merges or closes.
- Railway deploys PRs only from workspace members. The repository is public, so this matters.
- Before each `api` deploy, `/app/migrate` applies the schema and `/app/seed` gives each account in `SEED_SUBJECTS` five weeks of history. The seed skips accounts that already have plans, and it refuses non-`pk_test_` Clerk keys.
- `APP_ORIGINS` refers to the generated `web` domain. Each environment accepts sessions only from its own origin.

## Set up once

Run these from the repository root with the Railway CLI 5.42 or newer.

1. Sign in, create the project, and link this checkout to a new `staging` environment. Railway also creates an empty `production` environment; leave it unused.

   ```bash
   railway login
   railway init --name endorphins
   railway environment new staging
   railway link --project endorphins --environment staging
   ```

2. Install the IaC SDK and apply the configuration. Read the plan before you confirm it.

   ```bash
   cd .railway && bun install --frozen-lockfile && cd ..
   railway config plan
   railway config apply
   ```

3. Give `web` a Railway domain. PR environments get domains only when the base environment has them.

   ```bash
   railway domain --service web --port 3100 --environment staging
   ```

4. Copy the Clerk development keys from `frontend/.env.local`. The values go through stdin, not the command line. Add your Clerk user ID (from the Clerk dashboard) to `SEED_SUBJECTS` to get a seeded account in every preview.

   ```bash
   for service in api web; do for key in CLERK_SECRET_KEY VITE_CLERK_PUBLISHABLE_KEY; do grep "^$key=" frontend/.env.local | cut -d= -f2- | tr -d '"' | railway variable set "$key" --stdin --service "$service" --environment staging --skip-deploys; done; done
   railway variable set SEED_SUBJECTS=user_... --service api --environment staging
   ```

5. In the Railway dashboard, connect the GitHub repository to both services. Then open **Project Settings → Environments**, turn on **PR Environments**, and choose `staging` as the base environment.

## Use a preview

- Open a pull request. The Railway bot comments with the `web` URL when the environment is ready.
- Sign in with your Clerk development account. Accounts in `SEED_SUBJECTS` start with saved plans, completions and activity.
- Run the real-Clerk journeys against the preview: `make e2e-clerk URL=https://web-....up.railway.app`.
- An agent can drive the preview with Playwright MCP, as it does a local server.
- Read logs with `railway logs --service api --environment <environment>`. The environment list is `railway environment list --ephemeral --json`.

## Change the configuration

Edit `.railway/railway.ts`, run `railway config plan`, and read the diff. Apply it with `railway config apply`. Do not pass `--yes` or `--confirm-destructive` to an unread plan. Keep secrets in Railway variables as `preserve()`; never write their values to source.

## Limits

- Running services in each PR environment use Railway credits. Builds are free. Turn on focused PR environments or app sleeping if the cost grows.
- The Clerk development instance holds 100 users. The live Clerk suite deletes the users it creates.
- PR environments start empty, so they do not test schema upgrades. `make migration-check` and its CI job cover upgrades. `staging` keeps its data, so each merge also upgrades a populated database.
