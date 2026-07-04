# Base Stage
FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /usr/src/app

# Dependencies Stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

# Build Stage
FROM dependencies AS builder
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
RUN pnpm --filter shared build
RUN pnpm --filter worker build

# Production Runner Stage
FROM base AS runner
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/shared ./packages/shared
COPY --from=builder /usr/src/app/apps/worker ./apps/worker
CMD ["pnpm", "--filter", "worker", "start"]
