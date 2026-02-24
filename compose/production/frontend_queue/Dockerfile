FROM node:23-slim AS base

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    redis-tools \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ts-node globally
RUN npm install -g ts-node typescript

# Copy package files
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 queueworker
RUN chown -R queueworker:nodejs /app

USER queueworker

ENV NODE_ENV production

# Run the queue worker directly with ts-node for better debugging
CMD ["npx", "ts-node", "--project", "tsconfig.worker.json", "src/queue/worker.ts"]
