# ── Stage 1: Build ────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root
COPY package.json ./
COPY packages/web/package.json packages/web/
COPY packages/api/package.json packages/api/

# Install all dependencies (including devDependencies for building)
RUN npm install

# Copy source code (excluding what's in .dockerignore)
COPY packages/web packages/web
COPY packages/api packages/api

# Build frontend (empty VITE_API_URL = same-origin requests)
RUN cd packages/web && VITE_API_URL="" npx vite build

# Build API
RUN cd packages/api && npx nest build

# ── Stage 2: Production ──────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/

# Install production deps only
RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/api/dist packages/api/dist
COPY --from=builder /app/packages/web/dist packages/web/dist

# Copy nest-cli.json (needed by NestJS at runtime for path resolution)
COPY packages/api/nest-cli.json packages/api/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "packages/api/dist/main.js"]
