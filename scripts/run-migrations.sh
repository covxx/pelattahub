#!/bin/bash

# Database Migration Script
# Runs Prisma migrations independently of the deployment process
# Usage: ./scripts/run-migrations.sh [--timeout SECONDS] [--skip-wait]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMEOUT="${1:-120}"
SKIP_WAIT=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --timeout=*)
      TIMEOUT="${arg#*=}"
      shift
      ;;
    --skip-wait)
      SKIP_WAIT=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--timeout=SECONDS] [--skip-wait]"
      echo ""
      echo "Options:"
      echo "  --timeout=SECONDS  Set timeout for migration command (default: 120)"
      echo "  --skip-wait        Skip waiting for container/database to be ready"
      echo ""
      exit 0
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Database Migration Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if docker compose is available
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
  exit 1
fi

# Check if app container exists
if ! docker ps -a --format "{{.Names}}" | grep -q "^wms-app$"; then
  echo -e "${RED}❌ Container 'wms-app' not found${NC}"
  echo "   Make sure services are running: docker compose up -d"
  exit 1
fi

# Wait for container to be ready (unless skipped)
if [ "$SKIP_WAIT" = false ]; then
  echo -e "${YELLOW}⏳ Waiting for app container to be ready...${NC}"
  MAX_WAIT=30
  WAIT_COUNT=0
  CONTAINER_READY=false

  while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker compose exec -T app sh -c "echo 'ready'" >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Container is ready${NC}"
      CONTAINER_READY=true
      break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $((WAIT_COUNT % 5)) -eq 0 ]; then
      echo -e "${YELLOW}   Still waiting... (${WAIT_COUNT}s/${MAX_WAIT}s)${NC}"
    fi
    sleep 1
  done

  if [ "$CONTAINER_READY" = false ]; then
    echo -e "${YELLOW}⚠️  Container may not be fully ready, proceeding anyway...${NC}"
  fi

  # Wait for database service to be ready
  echo -e "${YELLOW}⏳ Waiting for database service to be ready...${NC}"
  DB_READY=false
  for i in {1..10}; do
    if docker compose exec -T db pg_isready -U wms >/dev/null 2>&1 2>/dev/null || \
       docker compose ps db 2>/dev/null | grep -q "Up"; then
      DB_READY=true
      echo -e "${GREEN}✅ Database service is ready${NC}"
      break
    fi
    if [ $i -lt 10 ]; then
      sleep 2
    fi
  done

  if [ "$DB_READY" = false ]; then
    echo -e "${YELLOW}⚠️  Database service may not be fully ready, proceeding anyway...${NC}"
  fi
fi

# Run migrations
echo -e "${BLUE}🔄 Running database migrations...${NC}"
echo -e "${YELLOW}   Using timeout: ${TIMEOUT}s${NC}"
echo ""

MIGRATION_SUCCESS=false
MIGRATION_OUTPUT=""
EXIT_CODE=0

if command -v timeout >/dev/null 2>&1; then
  echo -e "${BLUE}   Executing: npx prisma@6.19.0 migrate deploy${NC}"
  MIGRATION_OUTPUT=$(timeout "$TIMEOUT" docker compose exec -T app sh -c "npx --yes prisma@6.19.0 migrate deploy" 2>&1)
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    MIGRATION_SUCCESS=true
  elif [ $EXIT_CODE -eq 124 ]; then
    echo -e "${RED}❌ Migration deploy timed out after ${TIMEOUT} seconds${NC}"
  else
    echo -e "${RED}❌ Migration deploy failed (exit code: $EXIT_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  'timeout' command not available, running without timeout${NC}"
  echo -e "${BLUE}   Executing: npx prisma@6.19.0 migrate deploy${NC}"
  MIGRATION_OUTPUT=$(docker compose exec -T app sh -c "npx --yes prisma@6.19.0 migrate deploy" 2>&1)
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    MIGRATION_SUCCESS=true
  else
    echo -e "${RED}❌ Migration deploy failed (exit code: $EXIT_CODE)${NC}"
  fi
fi

echo ""

if [ "$MIGRATION_SUCCESS" = true ]; then
  echo -e "${GREEN}✅ Migrations completed successfully${NC}"
  
  # Show warnings if any
  if echo "$MIGRATION_OUTPUT" | grep -qi "warn"; then
    echo -e "${YELLOW}⚠️  Migration warnings:${NC}"
    echo "$MIGRATION_OUTPUT" | grep -i "warn" | head -5
  fi
  
  # Show summary if available
  if echo "$MIGRATION_OUTPUT" | grep -qi "already applied\|up to date\|No pending migrations"; then
    echo -e "${BLUE}📊 Migration status:${NC}"
    echo "$MIGRATION_OUTPUT" | grep -i "already applied\|up to date\|No pending migrations" | head -3
  fi
  
  exit 0
else
  echo -e "${RED}❌ Migration failed!${NC}"
  echo ""
  echo -e "${YELLOW}Migration output:${NC}"
  echo "$MIGRATION_OUTPUT"
  echo ""
  echo -e "${YELLOW}Troubleshooting:${NC}"
  echo "  • Check if migration files are missing: docker compose exec app ls -la prisma/migrations/"
  echo "  • Check Prisma logs above for specific error"
  echo "  • You may need to fix or remove corrupted migration directories"
  echo "  • Try running manually: docker compose exec app npx prisma migrate deploy"
  echo ""
  echo -e "${YELLOW}Application logs:${NC}"
  docker compose logs --tail=20 app
  exit 1
fi

