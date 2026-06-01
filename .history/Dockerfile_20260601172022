# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY server.js      ./server.js
COPY auth.js        ./auth.js
COPY db.js          ./db.js
COPY public/        ./public/
COPY package.json   ./package.json

# Criar diretório de dados para SQLite
RUN mkdir -p ./data && chown -R appuser:appgroup ./data

USER appuser

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Graceful startup
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
