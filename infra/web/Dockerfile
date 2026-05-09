FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY apps/web/package.json apps/web/pnpm-lock.yaml apps/web/.npmrc ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./
COPY _workspace /workspace
COPY apps/mobile/assets/data /mobile-data
RUN mkdir -p ../../_workspace ../mobile/assets/data \
 && cp -r /workspace/* ../../_workspace/ \
 && cp -r /mobile-data/* ../mobile/assets/data/
ARG NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
ENV NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=$NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app ./apps/web
COPY --from=builder /workspace ./_workspace
COPY --from=builder /mobile-data ./apps/mobile/assets/data
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start", "-H", "0.0.0.0", "-p", "3000"]
