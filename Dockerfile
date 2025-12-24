# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install git for commit ID extraction
RUN apk add --no-cache git

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Get git commit ID (if available) and set as build arg
# This will be available as NEXT_PUBLIC_COMMIT_ID during build
ARG COMMIT_ID
# Try to get commit ID from git if not provided as build arg
RUN if [ -z "$COMMIT_ID" ] && [ -d .git ]; then \
      COMMIT_ID=$(git rev-parse --short HEAD 2>/dev/null || echo ""); \
    fi

# Generate Prisma Client
# Provide a dummy DATABASE_URL for build time (prisma generate doesn't actually connect)
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy?schema=public"
RUN npx prisma@6.19.0 generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
# Set commit ID as environment variable for Next.js build (NEXT_PUBLIC_ prefix makes it available client-side)
ARG COMMIT_ID
ENV NEXT_PUBLIC_COMMIT_ID=${COMMIT_ID:-}
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy scripts directory and lib directory for sync service (only needed when running qbo-sync)
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy New Relic configuration files
COPY --from=builder --chown=nextjs:nodejs /app/newrelic.js ./newrelic.js
COPY --from=builder --chown=nextjs:nodejs /app/instrumentation.ts ./instrumentation.ts

# Create logs directory (fallback for any libraries that might need it)
# Must be done before switching to nextjs user
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs && chmod 755 /app/logs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
