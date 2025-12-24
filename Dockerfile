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

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
# Provide a dummy DATABASE_URL for build time (prisma generate doesn't actually connect)
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy?schema=public"
RUN npx prisma@6.19.0 generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
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