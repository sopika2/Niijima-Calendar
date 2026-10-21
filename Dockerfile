# syntax=docker/dockerfile:1

# ── Production dependencies (only better-sqlite3; everything else is bundled) ──
FROM node:22-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── Run ──────────────────────────────────────────────────────────────────────
FROM node:22-slim

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	CALENDAR_CONFIG=/app/settings/config.yml \
	CALENDAR_DATA=/app/data \
	CALENDAR_MIGRATIONS=/app/drizzle \
	CALENDAR_ASSETS=/app/assets

WORKDIR /app
COPY --from=deps /src/node_modules ./node_modules
COPY --from=build /src/build ./build
COPY --from=build /src/drizzle ./drizzle
COPY package.json config.example.yml ./

RUN mkdir -p /app/data /app/assets /app/settings && chown -R node:node /app/data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "build"]
