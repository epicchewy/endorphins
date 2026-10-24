import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac'

// Staging deploys master. Railway copies it into a PR environment for each pull
// request, with its own empty Postgres. Nothing here is production.
export default defineRailway(() => {
  const repo = github('epicchewy/endorphins', { branch: 'master' })
  const db = postgres('postgres')

  const api = service('api', {
    source: repo,
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'backend/Dockerfile',
      watchPatterns: ['backend/**', 'exercises/**'],
    },
    // A new PR database needs the schema and an account history to review.
    // Railway takes one pre-deploy command, so a shell runs both steps.
    preDeploy: "sh -c '/app/migrate && /app/seed'",
    healthcheck: '/readyz',
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      // Dual-stack, so the private network reaches it over IPv4 or IPv6.
      API_ADDRESS: '[::]:8088',
      PORT: '8088',
      APP_ORIGINS: 'https://${{web.RAILWAY_PUBLIC_DOMAIN}}',
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
      PORT: '3100',
      CLERK_SECRET_KEY: preserve(),
      VITE_CLERK_PUBLISHABLE_KEY: preserve(),
    },
  })

  return project('endorphins', { resources: [db, api, web] })
})
