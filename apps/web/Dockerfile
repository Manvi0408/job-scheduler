# Base Stage
FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /usr/src/app

# Dependencies Stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Build Stage
FROM dependencies AS builder
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter shared build
# NextJS build requires setting environment variable for api URL during build
ENV NEXT_PUBLIC_API_URL=http://localhost:3000
RUN pnpm --filter web build

# Production Runner Stage
FROM base AS runner
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/shared ./packages/shared
COPY --from=builder /usr/src/app/apps/web ./apps/web
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
