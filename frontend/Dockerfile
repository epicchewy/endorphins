FROM oven/bun:1.4.2 AS bun

FROM node:22.17.1-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend .
ARG BUILD_MODE=production
ARG VITE_CLERK_PUBLISHABLE_KEY
RUN bun run build --mode "${BUILD_MODE}" --outDir build \
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
