#!/bin/bash

# Emergency Recovery Script
# Restores services to a previous Docker image (not the latest)
# Usage: ./scripts/emergency-recover.sh [remote|local]
#   - remote: Restore on remote production server
#   - local: Restore on local machine (default)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TARGET="${1:-local}"
IMAGE_NAME="wms-app"
PROJECT_DIR="${PROJECT_DIR:-$HOME/opt/pelattahub}"

# Remote server configuration (from deploy-remote.sh)
SERVER_IP="178.156.221.237"
SSH_USER="root"
SSH_OPTS="${SSH_OPTS:-}"
REMOTE_HOST="${REMOTE_HOST:-${SSH_USER}@${SERVER_IP}}"
REMOTE_DIR="~/opt/pelattahub"

# =============================================================================
# FUNCTIONS
# =============================================================================

list_images() {
  local host="$1"
  if [ "$host" = "remote" ]; then
    ssh $SSH_OPTS "$REMOTE_HOST" "docker images $IMAGE_NAME --format '{{.ID}}\t{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' | head -10"
  else
    docker images $IMAGE_NAME --format '{{.ID}}\t{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' | head -10
  fi
}

get_image_ids() {
  local host="$1"
  if [ "$host" = "remote" ]; then
    ssh $SSH_OPTS "$REMOTE_HOST" "docker images $IMAGE_NAME --format '{{.ID}}'"
  else
    docker images $IMAGE_NAME --format '{{.ID}}'
  fi
}

enable_maintenance() {
  if [ "$TARGET" = "remote" ]; then
    ssh $SSH_OPTS "$REMOTE_HOST" 'sudo touch /etc/nginx/maintenance.on && sudo systemctl reload nginx' || true
  else
    echo -e "${YELLOW}⚠️  Maintenance mode not configured for local recovery${NC}"
  fi
}

disable_maintenance() {
  if [ "$TARGET" = "remote" ]; then
    ssh $SSH_OPTS "$REMOTE_HOST" 'sudo rm -f /etc/nginx/maintenance.on && sudo systemctl reload nginx' || true
  fi
}

# =============================================================================
# VALIDATION
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Emergency Docker Image Recovery${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$TARGET" = "remote" ]; then
  echo -e "${YELLOW}🌐 Target: Remote Production Server${NC}"
  echo "   Server: $REMOTE_HOST"
  echo "   Directory: $REMOTE_DIR"
  echo ""
  
  # Test SSH connection
  if ! ssh $SSH_OPTS "$REMOTE_HOST" "echo 'Connection test'" >/dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Cannot connect to remote server${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}💻 Target: Local Machine${NC}"
  echo ""
fi

# =============================================================================
# LIST AVAILABLE IMAGES
# =============================================================================
echo -e "${YELLOW}📋 Available Docker images (excluding latest):${NC}"
echo ""

# Get all image IDs
mapfile -t ALL_IMAGES < <(get_image_ids "$TARGET")

if [ "${#ALL_IMAGES[@]}" -eq 0 ]; then
  echo -e "${RED}❌ ERROR: No $IMAGE_NAME images found!${NC}"
  exit 1
fi

# Display images with index
echo -e "${BLUE}Available images (newest first):${NC}"
INDEX=0
for IMG_ID in "${ALL_IMAGES[@]}"; do
  INDEX=$((INDEX + 1))
  if [ "$TARGET" = "remote" ]; then
    IMG_INFO=$(ssh $SSH_OPTS "$REMOTE_HOST" "docker images $IMAGE_NAME --format '{{.ID}}\t{{.CreatedAt}}' | grep -F '$IMG_ID' | head -1")
  else
    IMG_INFO=$(docker images $IMAGE_NAME --format '{{.ID}}\t{{.CreatedAt}}' | grep -F "$IMG_ID" | head -1)
  fi
  
  CREATED=$(echo "$IMG_INFO" | awk '{print $2" "$3" "$4" "$5}')
  SHORT_ID=$(echo "$IMG_ID" | cut -c1-12)
  
  if [ "$INDEX" -eq 1 ]; then
    echo -e "  ${GREEN}[$INDEX]${NC} $SHORT_ID - $CREATED ${YELLOW}(CURRENT/LATEST)${NC}"
  else
    echo -e "  ${BLUE}[$INDEX]${NC} $SHORT_ID - $CREATED"
  fi
done

echo ""

# =============================================================================
# SELECT IMAGE TO RESTORE
# =============================================================================
if [ "${#ALL_IMAGES[@]}" -lt 2 ]; then
  echo -e "${RED}❌ ERROR: Only one image available. Cannot rollback.${NC}"
  exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will stop current services and restore to a previous image!${NC}"
echo ""
read -p "Select image to restore (2-${#ALL_IMAGES[@]}, or 'q' to quit): " SELECTION

if [ "$SELECTION" = "q" ] || [ "$SELECTION" = "Q" ]; then
  echo -e "${YELLOW}Cancelled.${NC}"
  exit 0
fi

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 2 ] || [ "$SELECTION" -gt "${#ALL_IMAGES[@]}" ]; then
  echo -e "${RED}❌ ERROR: Invalid selection${NC}"
  exit 1
fi

# Get selected image ID (convert to 0-based index)
SELECTED_INDEX=$((SELECTION - 1))
SELECTED_IMAGE_ID="${ALL_IMAGES[$SELECTED_INDEX]}"
SELECTED_SHORT_ID=$(echo "$SELECTED_IMAGE_ID" | cut -c1-12)

echo ""
echo -e "${YELLOW}Selected image: $SELECTED_SHORT_ID${NC}"
echo ""

# Confirm
read -p "Are you sure you want to restore to this image? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo -e "${YELLOW}Cancelled.${NC}"
  exit 0
fi

# =============================================================================
# ENABLE MAINTENANCE MODE
# =============================================================================
echo ""
echo -e "${YELLOW}🛡️  Enabling maintenance mode...${NC}"
enable_maintenance
echo -e "${GREEN}✅ Maintenance mode enabled${NC}"

# =============================================================================
# STOP CURRENT SERVICES
# =============================================================================
echo ""
echo -e "${YELLOW}🛑 Stopping current services...${NC}"

if [ "$TARGET" = "remote" ]; then
  ssh $SSH_OPTS "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose down"
else
  cd "$PROJECT_DIR" || {
    echo -e "${RED}❌ ERROR: Cannot access project directory: $PROJECT_DIR${NC}"
    exit 1
  }
  docker compose down
fi

echo -e "${GREEN}✅ Services stopped${NC}"

# =============================================================================
# TAG SELECTED IMAGE AS LATEST
# =============================================================================
echo ""
echo -e "${YELLOW}🏷️  Tagging selected image as $IMAGE_NAME:latest...${NC}"

if [ "$TARGET" = "remote" ]; then
  ssh $SSH_OPTS "$REMOTE_HOST" "docker tag $SELECTED_IMAGE_ID $IMAGE_NAME:latest"
else
  docker tag "$SELECTED_IMAGE_ID" "$IMAGE_NAME:latest"
fi

echo -e "${GREEN}✅ Image tagged${NC}"

# =============================================================================
# CREATE OVERRIDE FILE
# =============================================================================
echo ""
echo -e "${YELLOW}⚙️  Creating override file to use restored image...${NC}"

if [ "$TARGET" = "remote" ]; then
  ssh $SSH_OPTS "$REMOTE_HOST" "cd $REMOTE_DIR && cat > docker-compose.override.tmp.yml << 'EOF'
services:
  app:
    image: $IMAGE_NAME
  qbo-sync:
    image: $IMAGE_NAME
EOF
"
else
  cat > docker-compose.override.tmp.yml << EOF
services:
  app:
    image: $IMAGE_NAME
  qbo-sync:
    image: $IMAGE_NAME
EOF
fi

echo -e "${GREEN}✅ Override file created${NC}"

# =============================================================================
# START SERVICES WITH RESTORED IMAGE
# =============================================================================
echo ""
echo -e "${YELLOW}🚀 Starting services with restored image...${NC}"

if [ "$TARGET" = "remote" ]; then
  if ssh $SSH_OPTS "$REMOTE_HOST" "test -f $REMOTE_DIR/docker-compose.prod.yml"; then
    ssh $SSH_OPTS "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.tmp.yml up -d --no-build --force-recreate"
  else
    ssh $SSH_OPTS "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose -f docker-compose.yml -f docker-compose.override.tmp.yml up -d --no-build --force-recreate"
  fi
else
  docker compose -f docker-compose.yml -f docker-compose.override.tmp.yml up -d --no-build --force-recreate
fi

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to start services!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Services started${NC}"

# Wait for services to initialize
sleep 5

# =============================================================================
# VERIFY SERVICES
# =============================================================================
echo ""
echo -e "${YELLOW}📊 Checking service status...${NC}"

if [ "$TARGET" = "remote" ]; then
  ssh $SSH_OPTS "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose ps"
else
  docker compose ps
fi

# =============================================================================
# VERIFY IMAGE IN USE
# =============================================================================
echo ""
echo -e "${YELLOW}🔍 Verifying container is using restored image...${NC}"

if [ "$TARGET" = "remote" ]; then
  RUNNING_IMAGE_ID=$(ssh $SSH_OPTS "$REMOTE_HOST" "docker inspect wms-app --format='{{.Image}}' 2>/dev/null" | cut -d: -f2 | cut -c1-12)
else
  RUNNING_IMAGE_ID=$(docker inspect wms-app --format='{{.Image}}' 2>/dev/null | cut -d: -f2 | cut -c1-12)
fi

if [ "$RUNNING_IMAGE_ID" = "$SELECTED_SHORT_ID" ]; then
  echo -e "${GREEN}✅ Container is using the restored image${NC}"
  echo "   Image ID: $SELECTED_SHORT_ID"
else
  echo -e "${YELLOW}⚠️  Image ID mismatch${NC}"
  echo "   Expected: $SELECTED_SHORT_ID"
  echo "   Running:  $RUNNING_IMAGE_ID"
fi

# =============================================================================
# HEALTH CHECK
# =============================================================================
echo ""
echo -e "${YELLOW}🏥 Checking health endpoint...${NC}"

if [ "$TARGET" = "remote" ]; then
  HEALTH_URL="http://${SERVER_IP}:3000/api/health"
else
  HEALTH_URL="http://localhost:3000/api/health"
fi

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
  
  # Disable maintenance mode on success
  echo ""
  echo -e "${YELLOW}🛡️  Disabling maintenance mode...${NC}"
  disable_maintenance
  echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
else
  echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
  echo ""
  echo -e "${YELLOW}⚠️  Maintenance mode will remain enabled${NC}"
  echo -e "${YELLOW}   Check logs and fix issues before disabling maintenance mode${NC}"
fi

# =============================================================================
# CLEANUP
# =============================================================================
echo ""
echo -e "${YELLOW}🧹 Cleaning up temporary override file...${NC}"

if [ "$TARGET" = "remote" ]; then
  ssh $SSH_OPTS "$REMOTE_HOST" "cd $REMOTE_DIR && rm -f docker-compose.override.tmp.yml"
else
  rm -f docker-compose.override.tmp.yml
fi

echo -e "${GREEN}✅ Cleanup complete${NC}"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Emergency Recovery Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Recovery Summary:${NC}"
echo "  • Target: $TARGET"
echo "  • Restored Image: $SELECTED_SHORT_ID"
echo "  • Services: Restarted"
if [ "$HTTP_CODE" = "200" ]; then
  echo "  • Health Check: Passed"
  echo "  • Maintenance Mode: Disabled"
else
  echo "  • Health Check: Failed"
  echo "  • Maintenance Mode: Enabled (manual intervention required)"
fi
echo ""
echo -e "${BLUE}Next steps:${NC}"
if [ "$TARGET" = "remote" ]; then
  echo "  • Check logs: ssh $SSH_USER@$SERVER_IP 'cd $REMOTE_DIR && docker compose logs -f app'"
  echo "  • Check status: ssh $SSH_USER@$SERVER_IP 'cd $REMOTE_DIR && docker compose ps'"
else
  echo "  • Check logs: docker compose logs -f app"
  echo "  • Check status: docker compose ps"
fi
echo ""
