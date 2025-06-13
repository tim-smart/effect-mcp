FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable


FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile


FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm build 
RUN pnpm prune --prod


FROM base AS runner
ENV NODE_ENV=production
COPY package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.cjs"]
