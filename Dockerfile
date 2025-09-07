FROM node:alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable


FROM base AS builder
COPY . .
RUN --mount=type=cache,id=/pnpm/store,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build 
RUN pnpm prune --prod


FROM base AS runner
COPY package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.cjs"]
