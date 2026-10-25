import {
  database,
  defineRailway,
  github,
  image,
  preserve,
  project,
  service,
  volume,
} from 'railway/iac'

// `production` deploys master. Railway copies it into a PR environment for each
// pull request, with its own empty Postgres. No service has a public domain:
// people, agents and CI reach `web` only through the `tailnet` forwarder.
export default defineRailway(() => {
  const repo = github('epicchewy/endorphins', { branch: 'master' })
  // postgres() now provisions 18; tests, local dev and Postmaker run 17.
  const db = database('postgres', 'postgres', {
    image: 'ghcr.io/railwayapp-templates/postgres-ssl:17',
    output: 'DATABASE_URL',
    defaultMountPath: '/var/lib/postgresql/data',
  })

  const api = service('api', {
    source: repo,
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'backend/Dockerfile',
      watchPatterns: ['backend/**', 'exercises/**'],
    },
    // Railway takes one pre-deploy command, so a shell runs both steps. The
    // seed fills a new PR database and skips production by itself.
    preDeploy: "sh -c '/app/migrate && /app/seed'",
    healthcheck: '/readyz',
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      // Dual-stack, so the private network reaches it over IPv4 or IPv6.
      API_ADDRESS: '[::]:8088',
      PORT: '8088',
      // Sessions are accepted only from this environment's tailnet name.
      APP_ORIGINS: 'https://${{tailnet.TS_HOSTNAME}}.${{tailnet.TAILNET_DNS}}',
      CLERK_SECRET_KEY: preserve(),
      VITE_CLERK_PUBLISHABLE_KEY: preserve(),
      SEED_SUBJECTS: preserve(),
    },
  })

  const web = service('web', {
    source: repo,
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'frontend/Dockerfile',
      watchPatterns: ['frontend/**'],
    },
    healthcheck: '/',
    env: {
      API_ORIGIN: 'http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8088',
      // The forwarder dials web over the private network, which needs `::`.
      HOST: '::',
      PORT: '3100',
      CLERK_SECRET_KEY: preserve(),
      VITE_CLERK_PUBLISHABLE_KEY: preserve(),
    },
  })

  // The only way in. It joins the tailnet as `endorphins-<environment>`,
  // terminates HTTPS with the tailnet's certificate, and forwards to web.
  // A subnet router cannot work here: Postmaker's already holds the shared
  // Railway range on this tailnet, and PR environments would need one each.
  const tailnet = service('tailnet', {
    source: image('ghcr.io/brody192/tailscale-forwarder:v0.0.8'),
    env: {
      // Reusable, ephemeral, tagged tag:preview. Closed PRs drop off the tailnet.
      // Never seal it: Railway does not copy sealed values into PR environments.
      TS_AUTHKEY: preserve(),
      // The tailnet's DNS suffix, such as tail1234.ts.net.
      TAILNET_DNS: preserve(),
      TS_HOSTNAME: '${{RAILWAY_PROJECT_NAME}}-${{RAILWAY_ENVIRONMENT_NAME}}',
      // Keeps the same machine name across redeploys of one environment.
      TS_STATE_DIR: '/var/lib/tailscale',
      CONNECTION_MAPPING_01: 'https:443:${{web.RAILWAY_PRIVATE_DOMAIN}}:3100',
      CONNECTION_MAPPING_02: '5432:${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432',
    },
    volumeMounts: { '/var/lib/tailscale': volume('tailscale-state') },
  })

  return project('endorphins', { resources: [db, api, web, tailnet] })
})
