FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn prisma generate
RUN yarn build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3030
ENV DATABASE_URL=file:/workspace/data/podhomme.db

# Full node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Next.js app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Prisma schema, migrations, generated client, and config
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/app/generated ./app/generated

# Startup script
COPY scripts/docker-start.sh ./scripts/docker-start.sh
RUN chmod +x scripts/docker-start.sh

EXPOSE 3030
CMD ["./scripts/docker-start.sh"]
