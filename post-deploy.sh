#!/bin/bash

# Post-Deployment Script for Production Server
# Run this script on the production server after deploy-remote.sh completes
# Usage: ./post-deploy.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/root/wms}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Post-Deployment Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to project directory
cd "$PROJECT_DIR" || {
  echo -e "${RED}❌ ERROR: Cannot access project directory: $PROJECT_DIR${NC}"
  exit 1
}

# =============================================================================
# 1. Check Service Status
# =============================================================================
echo -e "${YELLOW}📊 Checking service status...${NC}"
docker compose ps

SERVICES_UP=$(docker compose ps --format json | jq -r 'select(.State == "running") | .Name' | wc -l)
if [ "$SERVICES_UP" -eq 0 ]; then
  echo -e "${RED}❌ No services are running!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# =============================================================================
# 2. Run Database Migrations
# =============================================================================
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
if docker compose exec -T app npx prisma migrate deploy; then
  echo -e "${GREEN}✅ Migrations completed${NC}"
else
  echo -e "${RED}❌ Migration failed! Check logs:${NC}"
  docker compose logs --tail=20 app
  exit 1
fi
echo ""

# =============================================================================
# 3. Verify Health Endpoint
# =============================================================================
echo -e "${YELLOW}🏥 Checking health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
else
  echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
  echo ""
  echo -e "${YELLOW}Checking application logs...${NC}"
  docker compose logs --tail=30 app
  exit 1
fi
echo ""

# =============================================================================
# 4. Show Recent Logs
# =============================================================================
echo -e "${YELLOW}📋 Recent application logs (last 20 lines):${NC}"
docker compose logs --tail=20 app
echo ""

# =============================================================================
# 5. Check for Errors in Logs
# =============================================================================
echo -e "${YELLOW}🔍 Checking for errors in logs...${NC}"
ERROR_COUNT=$(docker compose logs app 2>&1 | grep -i "error\|fatal\|exception" | tail -5 | wc -l)

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Found potential errors in logs:${NC}"
  docker compose logs app 2>&1 | grep -i "error\|fatal\|exception" | tail -5
  echo ""
else
  echo -e "${GREEN}✅ No recent errors found${NC}"
fi
echo ""

# =============================================================================
# 6. Summary
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Post-Deployment Verification Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Deployment Status:${NC}"
echo "  • Services: Running"
echo "  • Migrations: Completed"
echo "  • Health Check: Passed"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  • View logs: docker compose logs -f app"
echo "  • Check status: docker compose ps"
echo "  • Restart app: docker compose restart app"
echo ""

