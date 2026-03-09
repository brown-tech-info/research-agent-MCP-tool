# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace manifests and install all dependencies
COPY package.json package-lock.json ./
COPY apps/orchestrator/package.json ./apps/orchestrator/
COPY apps/frontend/package.json ./apps/frontend/
COPY servers/pubmed-mcp/package.json ./servers/pubmed-mcp/
COPY servers/clinicaltrials-mcp/package.json ./servers/clinicaltrials-mcp/
COPY servers/web-mcp/package.json ./servers/web-mcp/
COPY servers/m365-mail-mcp/package.json ./servers/m365-mail-mcp/
COPY servers/memory-mcp/package.json ./servers/memory-mcp/

RUN npm ci --ignore-scripts

# Copy all source and build
COPY tsconfig.json ./
COPY apps/orchestrator/ ./apps/orchestrator/
COPY servers/ ./servers/

RUN npm run build --workspaces --if-present

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy workspace manifests for production install
COPY package.json package-lock.json ./
COPY apps/orchestrator/package.json ./apps/orchestrator/
COPY servers/pubmed-mcp/package.json ./servers/pubmed-mcp/
COPY servers/clinicaltrials-mcp/package.json ./servers/clinicaltrials-mcp/
COPY servers/web-mcp/package.json ./servers/web-mcp/
COPY servers/m365-mail-mcp/package.json ./servers/m365-mail-mcp/
COPY servers/memory-mcp/package.json ./servers/memory-mcp/

# Install production dependencies only
RUN npm ci --ignore-scripts --omit=dev

# Copy built output from builder
COPY --from=builder /app/apps/orchestrator/dist ./apps/orchestrator/dist
COPY --from=builder /app/servers/pubmed-mcp/dist ./servers/pubmed-mcp/dist
COPY --from=builder /app/servers/clinicaltrials-mcp/dist ./servers/clinicaltrials-mcp/dist
COPY --from=builder /app/servers/web-mcp/dist ./servers/web-mcp/dist
COPY --from=builder /app/servers/m365-mail-mcp/dist ./servers/m365-mail-mcp/dist
COPY --from=builder /app/servers/memory-mcp/dist ./servers/memory-mcp/dist

# Audit log directory
RUN mkdir -p /app/apps/orchestrator/data

EXPOSE 3001

CMD ["node", "apps/orchestrator/dist/api-server.js"]
