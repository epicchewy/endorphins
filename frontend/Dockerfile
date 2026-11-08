FROM oven/bun:1.4.2 AS bun

FROM node:26.10.0-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend .
ARG BUILD_MODE=production
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_SENTRY_DSN
# Source map upload. Only this discarded build stage sees the token.
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
# Railway passes its own variables when declared: Sentry's environment and release.
ARG RAILWAY_ENVIRONMENT_NAME
ARG RAILWAY_GIT_COMMIT_SHA
RUN VITE_SENTRY_ENVIRONMENT="${RAILWAY_ENVIRONMENT_NAME:-production}" \
    bun run build --mode "${BUILD_MODE}" --outDir build \
    && if [ "${BUILD_MODE}" = production ]; then bun scripts/check-release.ts; fi

FROM bun
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/build ./build
COPY frontend/server.ts ./
USER bun
ENV HOST=0.0.0.0 PORT=3100
EXPOSE 3100
CMD ["bun", "run", "server.ts"]
