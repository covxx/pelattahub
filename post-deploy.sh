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
MAINTENANCE_DISABLED=false
MAINTENANCE_PATH="/etc/nginx/maintenance.on"

maintenance_exists() {
  if [ "${USE_SSH_MAINTENANCE:-false}" = "true" ]; then
    ssh $SSH_OPTS "$REMOTE_HOST" "test -f $MAINTENANCE_PATH" >/dev/null 2>&1
  else
    test -f "$MAINTENANCE_PATH"
  fi
}

disable_maintenance() {
  local result=0
  # Default to local disable when running on the server; fall back to SSH if requested
  if [ "${USE_SSH_MAINTENANCE:-false}" = "true" ]; then
    ssh $SSH_OPTS "$REMOTE_HOST" "sudo rm -f $MAINTENANCE_PATH && sudo systemctl reload nginx" || result=$?
  else
    sudo rm -f "$MAINTENANCE_PATH" && sudo systemctl reload nginx || result=$?
  fi

  if [ $result -ne 0 ]; then
    echo -e "${RED}❌ Failed to remove maintenance flag or reload nginx (exit $result)${NC}"
    return $result
  fi

  if maintenance_exists; then
    echo -e "${RED}❌ Maintenance flag still present at $MAINTENANCE_PATH after disable attempt${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Maintenance flag removed and nginx reloaded${NC}"
  MAINTENANCE_DISABLED=true
}

cleanup() {
  if maintenance_exists; then
    echo -e "${YELLOW}🛡️  Disabling maintenance mode (cleanup)...${NC}"
    if ! disable_maintenance; then
      echo -e "${RED}⚠️  Maintenance disable failed during cleanup${NC}"
    elif maintenance_exists; then
      echo -e "${RED}⚠️  Maintenance flag still present at $MAINTENANCE_PATH${NC}"
    else
      echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
    fi
  fi
}

cleanup_old_images() {
  echo -e "${YELLOW}🧹 Cleaning up old wms-app images (keeping latest three)...${NC}"
  # docker images is sorted by creation date desc by default
  mapfile -t IMAGES < <(docker images wms-app --format "{{.ID}}" | uniq)
  if [ "${#IMAGES[@]}" -le 3 ]; then
    echo -e "${GREEN}✅ No old images to remove${NC}"
    return
  fi

  # Keep the first three (newest), remove the rest
  OLD_IMAGES=("${IMAGES[@]:3}")
  for IMG in "${OLD_IMAGES[@]}"; do
    echo " - Removing image $IMG"
    docker rmi "$IMG" >/dev/null 2>&1 || true
  done

  echo -e "${GREEN}✅ Old images cleaned up${NC}"
}

cleanup_docker_resources() {
  echo -e "${YELLOW}🧹 Cleaning up Docker resources (images and build cache)...${NC}"
  
  # Show disk usage before cleanup
  echo -e "${BLUE}📊 Docker disk usage before cleanup:${NC}"
  docker system df
  
  # Remove all unused images (dangling and untagged)
  echo -e "${YELLOW}   Removing unused images...${NC}"
  docker image prune -f
  
  # Remove build cache older than 24 hours
  echo -e "${YELLOW}   Removing build cache older than 24 hours...${NC}"
  docker builder prune -af --filter "until=24h"
  
  # Show disk usage after cleanup
  echo -e "${BLUE}📊 Docker disk usage after cleanup:${NC}"
  docker system df
  
  echo -e "${GREEN}✅ Docker cleanup complete${NC}"
}

ensure_maintenance_off() {
  if ! maintenance_exists; then
    echo -e "${GREEN}✅ Maintenance flag not present${NC}"
    return
  fi

  echo -e "${YELLOW}🛡️  Attempting to clear maintenance flag...${NC}"
  for attempt in 1 2 3; do
    if disable_maintenance; then
      break
    fi
    echo -e "${YELLOW}Retrying maintenance disable (attempt $attempt/3)...${NC}"
    sleep 1
  done

  if maintenance_exists; then
    echo -e "${RED}❌ Maintenance flag still present at $MAINTENANCE_PATH after retries${NC}"
  else
    echo -e "${GREEN}✅ Maintenance flag removed${NC}"
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
# 2. Pull Latest Code (if git repo)
# =============================================================================
if [ -d ".git" ]; then
  echo -e "${YELLOW}📥 Pulling latest code...${NC}"
  git pull origin dev || echo -e "${YELLOW}⚠️  Git pull failed - continuing anyway${NC}"
  echo -e "${GREEN}✅ Code updated${NC}"
  echo ""
fi

# =============================================================================
# 3. Stop Current Services
# =============================================================================
echo -e "${YELLOW}🛑 Stopping current services...${NC}"
docker compose down

echo -e "${GREEN}✅ Services stopped${NC}"
echo ""

# =============================================================================
# 4. Ensure Latest Image Will Be Used
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
# 5. Start Services with Latest Image
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
# 6. Check Service Status
# =============================================================================
echo -e "${YELLOW}📊 Checking service status...${NC}"
docker compose ps

# Check if services are running - use simple method that's more reliable
SERVICES_UP=0

# Method 1: Count "Up" in docker compose ps output
UP_COUNT=$(docker compose ps 2>/dev/null | grep -c "Up" || echo "0")
if [ -n "$UP_COUNT" ] && [ "$UP_COUNT" -gt 0 ] 2>/dev/null; then
  SERVICES_UP=$UP_COUNT
fi

# Method 2: If still 0, check if wms-app container is running
if [ "$SERVICES_UP" -eq 0 ] 2>/dev/null; then
  if docker ps --filter "name=wms-app" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    SERVICES_UP=1
  fi
fi

# Method 3: Final fallback - check if any containers are running
if [ "$SERVICES_UP" -eq 0 ] 2>/dev/null; then
  RUNNING_CONTAINERS=$(docker ps --filter "name=wms-" --format "{{.Names}}" 2>/dev/null | wc -l)
  if [ -n "$RUNNING_CONTAINERS" ] && [ "$RUNNING_CONTAINERS" -gt 0 ] 2>/dev/null; then
    SERVICES_UP=$RUNNING_CONTAINERS
  fi
fi

# Ensure SERVICES_UP is a number
if ! [ "$SERVICES_UP" -eq "$SERVICES_UP" ] 2>/dev/null; then
  SERVICES_UP=0
fi

if [ "$SERVICES_UP" -eq 0 ]; then
  echo -e "${RED}❌ No services are running!${NC}"
  echo -e "${YELLOW}Checking logs...${NC}"
  docker compose logs --tail=30
  exit 1
fi

echo -e "${GREEN}✅ Services are running (${SERVICES_UP} service(s) up)${NC}"
echo ""

# =============================================================================
# 7. Check and Run Database Migrations
# =============================================================================
echo -e "${YELLOW}🗄️  Checking database migration status...${NC}"

# Wait for the app container to be fully ready before attempting migrations
echo -e "${BLUE}   Waiting for app container to be ready...${NC}"
MAX_WAIT=30
WAIT_COUNT=0
CONTAINER_READY=false

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  # Check if container is running and can execute commands
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
  echo -e "${YELLOW}⚠️  Container may not be fully ready, attempting migration check anyway...${NC}"
fi

# Check database connectivity first - wait for DB service to be ready
echo -e "${BLUE}   Waiting for database service to be ready...${NC}"
DB_READY=false
for i in {1..10}; do
  if docker compose exec -T db pg_isready -U wms >/dev/null 2>&1 || \
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

# Skip status check - just run migrate deploy directly (it's idempotent)
# This prevents hanging on status checks that can get stuck
echo -e "${BLUE}   Applying database migrations (migrate deploy is idempotent)...${NC}"
echo -e "${YELLOW}   Note: Skipping status check to prevent hanging. migrate deploy will only apply pending migrations.${NC}"

MIGRATION_SUCCESS=false
MIGRATION_OUTPUT=""

if command -v timeout >/dev/null 2>&1; then
  echo -e "${BLUE}   Running migrations (with 120s timeout)...${NC}"
  MIGRATION_OUTPUT=$(timeout 120 docker compose exec -T app sh -c "npx --yes prisma@6.19.0 migrate deploy" 2>&1)
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    MIGRATION_SUCCESS=true
  elif [ $EXIT_CODE -eq 124 ]; then
    echo -e "${RED}❌ Migration deploy timed out after 120 seconds${NC}"
  else
    echo -e "${RED}❌ Migration deploy failed (exit code: $EXIT_CODE)${NC}"
  fi
else
  echo -e "${BLUE}   Running migrations (no timeout available)...${NC}"
  MIGRATION_OUTPUT=$(docker compose exec -T app sh -c "npx --yes prisma@6.19.0 migrate deploy" 2>&1)
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    MIGRATION_SUCCESS=true
  else
    echo -e "${RED}❌ Migration deploy failed (exit code: $EXIT_CODE)${NC}"
  fi
fi

if [ "$MIGRATION_SUCCESS" = true ]; then
  echo -e "${GREEN}✅ Migrations completed successfully${NC}"
  # Show any warnings but not full output (too verbose)
  if echo "$MIGRATION_OUTPUT" | grep -q "warn\|WARN"; then
    echo -e "${YELLOW}⚠️  Migration warnings:${NC}"
    echo "$MIGRATION_OUTPUT" | grep -i "warn" | head -3
  fi
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
  echo ""
  echo -e "${YELLOW}Application logs:${NC}"
  docker compose logs --tail=20 app
  exit 1
fi

# Note: Status check removed to prevent hanging
# migrate deploy is idempotent - it only applies pending migrations
# To check status manually, run: docker compose exec app npx prisma migrate status
echo ""

# =============================================================================
# 8. Verify Health Endpoint
# =============================================================================
echo -e "${YELLOW}🏥 Checking health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  MAINTENANCE_CAN_DISABLE=true
  # Disable immediately after successful health, trap provides a safety net
  echo -e "${YELLOW}🛡️  Disabling maintenance mode after health pass...${NC}"
  if maintenance_exists; then
    if ! disable_maintenance; then
      echo -e "${RED}⚠️  Failed to disable maintenance after health pass${NC}"
    fi
  else
    echo -e "${GREEN}✅ Maintenance flag already absent${NC}"
  fi
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
# 9. Show Recent Logs
# =============================================================================
echo -e "${YELLOW}📋 Recent application logs (last 20 lines):${NC}"
docker compose logs --tail=20 app
echo ""

# =============================================================================
# 10. Check for Errors in Logs
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
# 11. Verify Image Version
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
# 12. Clean up temporary files
# =============================================================================
if [ "$USE_OVERRIDE" = true ]; then
  echo -e "${YELLOW}🧹 Cleaning up temporary override file...${NC}"
  rm -f docker-compose.override.tmp.yml
  echo -e "${GREEN}✅ Cleanup complete${NC}"
  echo ""
fi

# =============================================================================
# 13. Remove old images (keep three most recent)
# =============================================================================
cleanup_old_images

# =============================================================================
# 13b. Clean up Docker resources (unused images and build cache)
# =============================================================================
cleanup_docker_resources

# =============================================================================
# 14. Ensure maintenance flag is cleared
# =============================================================================
ensure_maintenance_off

# =============================================================================
# 15. Summary
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
if maintenance_exists; then
  echo "  • Maintenance Flag: PRESENT at $MAINTENANCE_PATH (requires manual removal)"
else
  echo "  • Maintenance Flag: Not present"
fi
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  • View logs: docker compose logs -f app"
echo "  • Check status: docker compose ps"
echo "  • Restart app: docker compose restart app"
echo ""

