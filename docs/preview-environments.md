# Railway production and previews

Endorphins runs in three places: locally with `make dev`, in a Railway PR environment for each pull request, and in the persistent Railway `production` environment. There is no staging. Production and previews have no public domain; like Postmaker, they are reachable only over Tailscale. Both use the Clerk development instance, because a Clerk production instance needs a domain you own, and `ts.net` names belong to Tailscale.

```text
pull request ─► Railway PR environment (a copy of production)

your tailnet ──HTTPS──► tailnet ──► web ──/api──► api ──► postgres
devices, agents, CI     forwarder   [::]:3100     [::]:8088  empty per PR
```

- [`.railway/railway.ts`](../.railway/railway.ts) defines the services, build settings, health checks and variables. Railway does not read it during deploys. `railway config plan` previews a change and `railway config apply` applies it to the linked environment.
- `production` deploys `master`. Railway copies its services and variables into each PR environment, with an empty Postgres and new database credentials, and deletes the environment when the PR merges or closes. Railway deploys PRs only from workspace members; the repository is public, so this matters.
- Before each `api` deploy, `/app/migrate` applies the schema. `/app/seed` then gives each account in `SEED_SUBJECTS` five weeks of history in PR environments. The seed skips the environment named `production`, refuses non-`pk_test_` Clerk keys, and never adds to an account that has plans.
- The `tailnet` service runs the [Tailscale Forwarder](https://docs.railway.com/guides/set-up-a-tailscale-forwarder). It joins your tailnet as `endorphins-<environment>`, serves HTTPS on port 443 with the tailnet's certificate, and forwards to `web` over the private network. Port 5432 forwards to Postgres. `APP_ORIGINS` names that HTTPS origin, so each environment accepts sessions only from its own tailnet name.
- Postmaker uses a Tailscale subnet router instead. That cannot work here: only one subnet router per tailnet can carry Railway's shared private range, Postmaker's already does, and each PR environment would need its own. Clerk also needs HTTPS, which the subnet router's plain `http://*.railway.internal` access does not give.

## Set up once

In the Tailscale admin console:

1. On the DNS page, turn on MagicDNS and HTTPS certificates. Note your tailnet's DNS suffix, such as `tail1234.ts.net`.
2. Add the tags and an access rule to the policy file, so only your devices and CI reach the environments:

   ```json
   "tagOwners": { "tag:preview": ["autogroup:admin"], "tag:ci": ["autogroup:admin"] },
   "grants": [{ "src": ["autogroup:member", "tag:ci"], "dst": ["tag:preview"], "ip": ["tcp:443", "tcp:5432"] }]
   ```

3. Generate an auth key that is reusable and ephemeral, with the tag `tag:preview`. Ephemeral machines leave the tailnet by themselves after their PR environment is deleted. Keys expire after at most 90 days.

From the repository root, with the Railway CLI 5.42 or newer:

1. Sign in, create the project and link this checkout to its `production` environment:

   ```bash
   railway login
   railway init --name endorphins
   railway link --project endorphins --environment production
   ```

2. Install the IaC SDK and apply the configuration. Read the plan before you confirm it.

   ```bash
   cd .railway && bun install --frozen-lockfile && cd ..
   railway config plan
   railway config apply
   ```

3. Set the variables. Values go through stdin, not the command line. PR environments copy all of them; never seal them, because Railway does not copy sealed values.

   ```bash
   for service in api web; do for key in CLERK_SECRET_KEY VITE_CLERK_PUBLISHABLE_KEY; do grep "^$key=" frontend/.env.local | cut -d= -f2- | tr -d '"' | railway variable set "$key" --stdin --service "$service" --environment production --skip-deploys; done; done
   railway variable set TS_AUTHKEY --stdin --service tailnet --environment production --skip-deploys
   railway variable set TAILNET_DNS=tail1234.ts.net --service tailnet --environment production --skip-deploys
   railway variable set SEED_SUBJECTS=user_... --service api --environment production
   ```

   Paste the auth key at the `TS_AUTHKEY` prompt and press Ctrl-D. `SEED_SUBJECTS` holds your Clerk user ID; previews seed it and production skips it.

4. In the Railway dashboard, connect the GitHub repository to `api` and `web`. Open **Project Settings → Environments** and turn on **PR Environments**; the base environment is `production`. Do not generate a domain for any service.

## Use an environment

- Production: `https://endorphins-production.<your-tailnet>.ts.net`.
- A preview: open the pull request and wait for the Railway bot to report the environment. Then open `https://endorphins-<environment>.<your-tailnet>.ts.net`. `tailscale status | grep endorphins` lists the machines. The bot's own link does not work, because no service has a Railway domain.
- Sign in with your Clerk development account. Accounts in `SEED_SUBJECTS` start with plans, completions and activity in previews.
- Run the real-Clerk journeys against an environment: `make e2e-clerk URL=https://endorphins-<environment>.<your-tailnet>.ts.net`.
- Agents on a tailnet device reach the same URLs, for example with Playwright MCP. CI joins the tailnet with `tailscale/github-action` and `tag:ci`.
- Connect to an environment's database over the tailnet at `endorphins-<environment>:5432`, or without Tailscale with `railway connect postgres --tunnel-only`.
- Read logs with `railway logs --service api --environment <environment>`. List previews with `railway environment list --ephemeral --json`.

## Change the configuration

Edit `.railway/railway.ts`, run `railway config plan`, and read the diff. Apply it with `railway config apply`. Do not pass `--yes` or `--confirm-destructive` to an unread plan. Keep secrets in Railway variables as `preserve()`; never write their values to source.

## Limits

- Every merge to `master` deploys production. A failed migration stops that deploy, and the running version keeps serving. PR environments start empty, so they do not test upgrades: `make migration-check` and its CI job do, and production is the first populated database to receive a change.
- Local dev, previews and production share the Clerk development instance and its 100-user limit.
- Railway keeps production data in the Postgres volume. Turn on volume backups in the dashboard before relying on it.
- Running services in each PR environment use Railway credits; builds are free. Turn on focused PR environments or app sleeping if the cost grows.
- If a forwarder loses its state volume, it rejoins as `endorphins-<environment>-1` and sign-in fails until you remove the old machine in the Tailscale admin console.
- Tailscale's HTTPS certificates publish machine names, such as `endorphins-production`, in public certificate logs. Traffic stays private.
- Not yet verified against a live project: that Railway resolves the composed `${{…}}` values, and that PR environment names are valid DNS labels. The first `railway config plan` and preview show both.
