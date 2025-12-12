#!/bin/bash

# Post-Deployment Script for Production Server
# Run this script on the production server after deploy-remote.sh completes
# Usage: ./post-deploy.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="${PROJECT_DIR:-$HOME/opt/pelattahub}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
SERVER_IP="${SERVER_IP:-178.156.221.237}"
SSH_USER="${SSH_USER:-root}"
SSH_OPTS="${SSH_OPTS:-}"
REMOTE_HOST="${REMOTE_HOST:-${SSH_USER}@${SERVER_IP}}"

MAINTENANCE_CAN_DISABLE=false

disable_maintenance() {
  ssh $SSH_OPTS "$REMOTE_HOST" 'sudo rm -f /etc/nginx/maintenance.on && sudo systemctl reload nginx'
}

cleanup() {
  if [ "$MAINTENANCE_CAN_DISABLE" = true ]; then
    echo -e "${YELLOW}🛡️  Disabling maintenance mode...${NC}"
    disable_maintenance
    echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
  fi
}

trap cleanup EXIT

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Post-Deployment Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Expand tilde if present in PROJECT_DIR
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"

# Change to project directory
cd "$PROJECT_DIR" || {
  echo -e "${RED}❌ ERROR: Cannot access project directory: $PROJECT_DIR${NC}"
  exit 1
}

# =============================================================================
# 1. Verify Latest Image is Available
# =============================================================================
echo -e "${YELLOW}🔍 Verifying latest Docker image...${NC}"
IMAGE_EXISTS=$(docker images wms-app --format "{{.Repository}}" | head -1)

if [ -z "$IMAGE_EXISTS" ]; then
  echo -e "${RED}❌ ERROR: wms-app image not found!${NC}"
  echo "   The image should have been loaded by deploy-remote.sh"
  exit 1
fi

IMAGE_ID=$(docker images wms-app --format "{{.ID}}" | head -1)
IMAGE_CREATED=$(docker images wms-app --format "{{.CreatedAt}}" | head -1)
echo -e "${GREEN}✅ Found image: wms-app${NC}"
echo "   Image ID: $IMAGE_ID"
echo "   Created: $IMAGE_CREATED"
echo ""

# =============================================================================
# 2. Stop Current Services
# =============================================================================
echo -e "${YELLOW}🛑 Stopping current services...${NC}"
docker compose down

echo -e "${GREEN}✅ Services stopped${NC}"
echo ""

# =============================================================================
# 3. Ensure Latest Image Will Be Used
# =============================================================================
echo -e "${YELLOW}⚙️  Preparing to use latest image...${NC}"

# Check if docker-compose.yml uses 'image:' directive
if grep -q "^[[:space:]]*image:[[:space:]]*wms-app" docker-compose.yml 2>/dev/null; then
  echo -e "${GREEN}✅ docker-compose.yml configured to use image: wms-app${NC}"
  USE_OVERRIDE=false
elif grep -q "^[[:space:]]*build:" docker-compose.yml 2>/dev/null; then
  echo -e "${YELLOW}ℹ️  docker-compose.yml has 'build:' section${NC}"
  echo -e "${YELLOW}   Creating override file to use loaded image...${NC}"
  
  # Create a temporary override file to specify the image
  cat > docker-compose.override.tmp.yml << 'EOF'
services:
  app:
    image: wms-app
EOF
  
  USE_OVERRIDE=true
  echo -e "${GREEN}✅ Created docker-compose.override.tmp.yml to use image: wms-app${NC}"
else
  echo -e "${GREEN}✅ docker-compose.yml configuration looks good${NC}"
  USE_OVERRIDE=false
fi
echo ""

# =============================================================================
# 4. Start Services with Latest Image
# =============================================================================
echo -e "${YELLOW}🚀 Starting services with latest image...${NC}"

# Use --no-build to ensure we use the loaded image, not build a new one
# Use --force-recreate to ensure containers are recreated with the new image
# Include override file if created
if [ "$USE_OVERRIDE" = true ]; then
  docker compose -f docker-compose.yml -f docker-compose.override.tmp.yml up -d --force-recreate --no-build
else
  docker compose up -d --force-recreate --no-build
fi

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to start services!${NC}"
  docker compose logs --tail=30
  exit 1
fi

echo -e "${GREEN}✅ Services started with latest image${NC}"
echo ""

# Wait a moment for services to initialize
sleep 3

# =============================================================================
# 5. Check Service Status
# =============================================================================
echo -e "${YELLOW}📊 Checking service status...${NC}"
docker compose ps

# Check if services are running - use multiple methods for reliability
SERVICES_UP=$(docker compose ps --format json 2>/dev/null | jq -r 'select(.State == "running") | .Name' 2>/dev/null | wc -l || echo "0")

# Alternative check: count containers with "Up" status
if [ "$SERVICES_UP" -eq 0 ]; then
  SERVICES_UP=$(docker compose ps 2>/dev/null | grep -c "Up" || echo "0")
fi

# Final check: verify container exists and is running
if [ "$SERVICES_UP" -eq 0 ]; then
  # Check if wms-app container exists and is running
  if docker ps --filter "name=wms-app" --format "{{.Status}}" | grep -q "Up"; then
    SERVICES_UP=1
  fi
fi

if [ "$SERVICES_UP" -eq 0 ]; then
  echo -e "${RED}❌ No services are running!${NC}"
  echo -e "${YELLOW}Checking logs...${NC}"
  docker compose logs --tail=30
  exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# =============================================================================
# 6. Run Database Migrations
# =============================================================================
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
# Use the Prisma version from package.json (6.19.0)
# The --yes flag prevents npx from prompting, and @6.19.0 ensures we use the correct version
if docker compose exec -T app sh -c "npx --yes prisma@6.19.0 migrate deploy"; then
  echo -e "${GREEN}✅ Migrations completed${NC}"
else
  echo -e "${RED}❌ Migration failed! Check logs:${NC}"
  docker compose logs --tail=20 app
  exit 1
fi
echo ""

# =============================================================================
# 7. Verify Health Endpoint
# =============================================================================
echo -e "${YELLOW}🏥 Checking health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  MAINTENANCE_CAN_DISABLE=true
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
# 8. Show Recent Logs
# =============================================================================
echo -e "${YELLOW}📋 Recent application logs (last 20 lines):${NC}"
docker compose logs --tail=20 app
echo ""

# =============================================================================
# 9. Check for Errors in Logs
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
# 10. Verify Image Version
# =============================================================================
echo -e "${YELLOW}🔍 Verifying running container uses latest image...${NC}"

# Get the image ID from the running container
RUNNING_IMAGE_ID=$(docker inspect wms-app --format='{{.Image}}' 2>/dev/null | cut -d: -f2 | cut -c1-12)

# Get the latest wms-app image ID
LATEST_IMAGE_ID=$(docker images wms-app --format "{{.ID}}" | head -1 | cut -c1-12)

if [ -z "$RUNNING_IMAGE_ID" ]; then
  echo -e "${YELLOW}⚠️  Could not get running container image ID${NC}"
elif [ -z "$LATEST_IMAGE_ID" ]; then
  echo -e "${YELLOW}⚠️  Could not get latest image ID${NC}"
elif [ "$RUNNING_IMAGE_ID" = "$LATEST_IMAGE_ID" ]; then
  echo -e "${GREEN}✅ Container is using the latest image${NC}"
  echo "   Running Image ID: $RUNNING_IMAGE_ID"
  echo "   Latest Image ID:  $LATEST_IMAGE_ID"
else
  echo -e "${YELLOW}⚠️  Container image ID doesn't match latest${NC}"
  echo "   Running: $RUNNING_IMAGE_ID"
  echo "   Latest:  $LATEST_IMAGE_ID"
  echo -e "${YELLOW}   Attempting to fix by recreating container...${NC}"
  
  # Try to recreate with the correct image
  docker compose down
  docker compose up -d --no-build
  sleep 2
  
  # Check again
  RUNNING_IMAGE_ID=$(docker inspect wms-app --format='{{.Image}}' 2>/dev/null | cut -d: -f2 | cut -c1-12)
  if [ "$RUNNING_IMAGE_ID" = "$LATEST_IMAGE_ID" ]; then
    echo -e "${GREEN}✅ Container now using the latest image${NC}"
  else
    echo -e "${YELLOW}⚠️  Image IDs still don't match - may need manual intervention${NC}"
  fi
fi
echo ""

# =============================================================================
# 11. Clean up temporary files
# =============================================================================
if [ "$USE_OVERRIDE" = true ]; then
  echo -e "${YELLOW}🧹 Cleaning up temporary override file...${NC}"
  rm -f docker-compose.override.tmp.yml
  echo -e "${GREEN}✅ Cleanup complete${NC}"
  echo ""
fi

# =============================================================================
# 11. Summary
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Post-Deployment Verification Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Deployment Status:${NC}"
echo "  • Image: Loaded and verified"
echo "  • Services: Running with latest image"
echo "  • Migrations: Completed"
echo "  • Health Check: Passed"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  • View logs: docker compose logs -f app"
echo "  • Check status: docker compose ps"
echo "  • Restart app: docker compose restart app"
echo ""

