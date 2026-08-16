# syntax=docker/dockerfile:1.7
# Production image for VM / ECS. Build from the EOI_CP repo root:
#   docker build -t goyal-eoi-web .
#   docker run --env-file .env.production -p 3000:3000 goyal-eoi-web
#
# Runtime env (DATABASE_URL, REDIS_URL, S3_*, APP_URL, NEXTAUTH_URL, …)
# is injected at run time. Do not COPY .env.production into the image.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# --- install (lockfile layer; busts only when manifests change) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ecosystem-contracts/package.json packages/ecosystem-contracts/package.json
COPY packages/email/package.json packages/email/package.json
COPY packages/integration-hub/package.json packages/integration-hub/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
# postinstall runs prisma generate; schema is not in this layer yet.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund

# --- build Next standalone (linux-musl Prisma engine) ---
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=2048
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY . .
# generate uses a placeholder URL; it does not connect to RDS.
RUN npm run db:generate \
    && npm run build --workspace=@goyal/web \
    && test -f apps/web/.next/standalone/apps/web/server.js

# --- runtime: traced server only ---
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache tini wget ca-certificates \
    && addgroup -S nodejs \
    && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
STOPSIGNAL SIGTERM
# Liveness only. Full /api/health still checks DB, S3, Redis.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:3000/api/health?live=1" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
