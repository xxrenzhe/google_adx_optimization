FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl-dev openssl su-exec
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Ensure public directory exists
RUN mkdir -p /app/public

# Create necessary directories
RUN mkdir -p uploads results && chmod 755 uploads results

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Database initialization will be handled at runtime

# Lint & Build the application
RUN \
  if [ -f yarn.lock ]; then yarn run lint; \
  elif [ -f package-lock.json ]; then npm run lint; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run lint; \
  else echo "Lockfile not found." && exit 1; \
  fi && \
  \
  \
  \
  \
  \
  \
  \
  \
  \
  \
  \
  \
  \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV npm_config_cache=/data/.npm

# Install OpenSSL for Prisma and increase Node.js memory limit
RUN apk add --no-cache openssl-dev openssl su-exec
RUN apk add --no-cache curl

# Set Node.js memory limit to 1.5GB for processing large files
ENV NODE_OPTIONS="--max-old-space-size=1536"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create necessary directories in runner
RUN mkdir -p uploads results && chmod 755 uploads results

# Set the correct permission for prerender cache
RUN mkdir -p .next
RUN chown nextjs:nodejs .next

# Copy Prisma schema and runtime scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy the standalone output (minimal footprint for 1C2G)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static files - required for JS/CSS assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Copy package.json for npm scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Include full node_modules to ensure Prisma CLI and its transitive deps are available offline
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Use persistent cache directory for Next.js to reduce ephemeral storage usage
ENV NEXT_CACHE_DIR=/data/next-cache
RUN rm -rf .next/cache && ln -s /data/next-cache .next/cache

# Create directories with correct permissions
RUN mkdir -p uploads results data && chown nextjs:nodejs uploads results data && chmod 755 uploads results data

# Create /data directories for production (need root for /data)
USER root
RUN mkdir -p /data/uploads /data/results && chown nextjs:nodejs /data/uploads /data/results && chmod 755 /data/uploads /data/results

# Start as root to ensure /data permissions are correct
USER root

# Ensure /data directories exist and have correct permissions on startup
RUN mkdir -p /data/uploads /data/results && chown -R nextjs:nodejs /data && chmod -R 755 /data

# Copy entrypoint script
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install su-exec for switching users (alpine doesn't have gosu)
RUN apk add --no-cache su-exec

# Stay as root - entrypoint will switch to nextjs
USER root

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Use entrypoint script to ensure permissions
ENTRYPOINT ["/entrypoint.sh"]

# Healthcheck: app must respond on /api/health
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
