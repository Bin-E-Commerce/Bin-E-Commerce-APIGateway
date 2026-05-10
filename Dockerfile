# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./

COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/api-gateway/tsconfig.json ./services/api-gateway/
COPY services/api-gateway/src ./services/api-gateway/src

COPY packages/common ./packages/common

RUN npm install --workspace=services/api-gateway

WORKDIR /app/services/api-gateway
RUN npx nest build

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder /app/services/api-gateway/package.json ./
COPY --from=builder /app/packages/common ./packages/common

RUN npm install --omit=dev

COPY --from=builder /app/services/api-gateway/dist ./dist

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "--max-old-space-size=100", "dist/main"]
