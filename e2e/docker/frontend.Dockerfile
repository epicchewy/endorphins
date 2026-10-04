FROM oven/bun:1.4.2 AS bun

FROM node:22.17.1-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend .
RUN VITE_CLERK_PUBLISHABLE_KEY=pk_test_c21va2UuY2xlcmsuYWNjb3VudHMuZGV2JA \
    bun run build --mode e2e

FROM bun
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/build-e2e ./build
COPY frontend/server.ts ./
USER bun
ENV HOST=0.0.0.0 PORT=3100
EXPOSE 3100
CMD ["bun", "run", "server.ts"]
