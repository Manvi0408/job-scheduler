# Base Stage
FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /usr/src/app

# Dependencies Stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# Build Stage
FROM dependencies AS builder
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter shared build
RUN pnpm --filter api build

# Production Runner Stage
FROM base AS runner
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/shared ./packages/shared
COPY --from=builder /usr/src/app/apps/api ./apps/api
EXPOSE 3000
CMD ["pnpm", "--filter", "api", "start"]
