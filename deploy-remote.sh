#!/bin/bash

set -euo pipefail

# Remote Deployment Script
# Builds Docker image locally and ships it to the remote server
# This prevents OOM crashes on the VPS by building on a machine with more RAM

# =============================================================================
# CONFIGURATION
# =============================================================================
# Set your Hetzner VPS IP address here
SERVER_IP="178.156.221.237"

# Set the SSH user (typically 'root' for VPS)
SSH_USER="root"

# SSH options (e.g., "-i /path/to/key -o StrictHostKeyChecking=no")
SSH_OPTS="${SSH_OPTS:-}"

# Convenience host target for SSH commands
REMOTE_HOST="${REMOTE_HOST:-${SSH_USER}@${SERVER_IP}}"

# Set the remote project directory
REMOTE_DIR="~/opt/pelattahub"

enable_maintenance() {
  ssh $SSH_OPTS "$REMOTE_HOST" 'sudo touch /etc/nginx/maintenance.on && sudo systemctl reload nginx'
}

# =============================================================================
# VALIDATION
# =============================================================================
if [ "$SERVER_IP" = "YOUR_HETZNER_IP_HERE" ]; then
  echo "❌ ERROR: Please set SERVER_IP in deploy-remote.sh"
  exit 1
fi

# =============================================================================
# BUILD LOCALLY
# =============================================================================
echo "🔨 Building Docker image locally (amd64 platform)..."
# Get current git commit ID for version display
COMMIT_ID=$(git rev-parse --short HEAD 2>/dev/null || echo "")
if [ -n "$COMMIT_ID" ]; then
  echo "📝 Building with commit ID: $COMMIT_ID"
  docker build --platform linux/amd64 --no-cache --build-arg COMMIT_ID="$COMMIT_ID" -t wms-app .
else
  echo "⚠️  No git commit ID available, building without commit ID"
  docker build --platform linux/amd64 --no-cache -t wms-app .
fi

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ Build complete!"

# =============================================================================
# SHIP ARTIFACT TO REMOTE SERVER
# =============================================================================
echo "📦 Shipping Docker image to remote server..."
echo "   This may take a few minutes depending on image size and connection speed..."

docker save wms-app | bzip2 | ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && bunzip2 | docker load"

if [ $? -ne 0 ]; then
  echo "❌ Failed to transfer image to remote server!"
  exit 1
fi

echo "✅ Image transferred successfully!"

# =============================================================================
# CLEANUP DOCKER RESOURCES ON LOCAL DEV SERVER
# =============================================================================
echo ""
echo "🧹 Cleaning up Docker resources on local dev server..."
echo "   Removing unused images and build cache older than 24h..."

# Clean up unused images and build cache on local machine
docker image prune -f && docker builder prune -af --filter "until=24h" || echo "⚠️  Local cleanup had some issues (non-critical)"

echo "✅ Local cleanup complete"

# =============================================================================
# PULL LATEST CODE ON REMOTE SERVER
# =============================================================================
echo "📥 Pulling latest code on remote server..."
ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && git pull origin dev || echo '⚠️  Git pull failed or not a git repo - continuing anyway'"
echo "✅ Code updated (if applicable)"

# =============================================================================
# RESTART REMOTE SERVICES
# =============================================================================
echo "🛡️ Enabling maintenance mode on remote server..."
enable_maintenance
echo "✅ Maintenance mode enabled."

echo "🚀 Restarting services on remote server..."

# Create temporary override file to use the loaded image instead of building
echo "   Creating temporary override to use loaded image..."
ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && cat > docker-compose.override.tmp.yml << 'EOF'
services:
  app:
    image: wms-app
  qbo-sync:
    image: wms-app
EOF
"

# Use production override if it exists, otherwise use base compose file
# Always use --no-build to prevent building on remote server
# Use --force-recreate to ensure containers use the new image
if ssh ${SSH_OPTS} "${REMOTE_HOST}" "test -f ${REMOTE_DIR}/docker-compose.prod.yml"; then
  ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.tmp.yml up -d --no-build --force-recreate"
else
  ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose -f docker-compose.yml -f docker-compose.override.tmp.yml up -d --no-build --force-recreate"
fi

if [ $? -ne 0 ]; then
  echo "❌ Failed to restart services on remote server!"
  exit 1
fi

# Clean up temporary override file
echo "   Cleaning up temporary override file..."
ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && rm -f docker-compose.override.tmp.yml"

echo "✅ Deployment complete!"
echo ""
echo "📊 Checking service status..."
ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose ps"

# =============================================================================
# CLEANUP DOCKER RESOURCES ON REMOTE PRODUCTION SERVER
# =============================================================================
echo ""
echo "🧹 Cleaning up Docker resources on remote production server..."
echo "   Removing unused images and build cache older than 24h..."

# Clean up unused images and build cache on remote server
ssh ${SSH_OPTS} "${REMOTE_HOST}" "docker image prune -f && docker builder prune -af --filter 'until=24h'" || echo "⚠️  Remote cleanup had some issues (non-critical)"

echo "✅ Remote cleanup complete"
echo ""

echo "📋 Next steps on production server:"
echo "   1. Run post-deploy verification (recommended):"
echo "      ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && ./post-deploy.sh'"
echo ""
echo "   2. Or manually run database migrations (if schema changed):"
echo "      ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && docker compose exec app npx prisma migrate deploy'"
echo ""
echo "   3. Check application logs:"
echo "      ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && docker compose logs -f app'"
echo ""
echo "   4. Verify health endpoint:"
echo "      curl http://${SERVER_IP}:3000/api/health"
echo ""
echo "   5. Check service status:"
echo "      ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && docker compose ps'"

