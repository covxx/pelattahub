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
# Initialize log files
BUILD_LOG=$(mktemp)
TRANSFER_LOG=$(mktemp)
COMPOSE_LOG=$(mktemp)

# Cleanup function for all log files
cleanup_logs() {
  rm -f "$BUILD_LOG" "$TRANSFER_LOG" "$COMPOSE_LOG" 2>/dev/null
}
trap cleanup_logs EXIT

echo "🔨 Building Docker image locally (amd64 platform)..."
echo ""

# Build with output captured to log file, but display Docker's clean output normally
# Docker's buildkit output is nicely formatted - tee writes to both stdout (terminal) and log file
if docker build --platform linux/amd64 --no-cache -t wms-app . 2>&1 | tee "$BUILD_LOG"; then
  echo ""
  echo "✅ Build complete!"
  
  # Analyze the captured log for warnings and errors (without cluttering the nice output)
  WARNINGS=$(grep -i "warning" "$BUILD_LOG" | wc -l || echo "0")
  ERRORS=$(grep -i "error" "$BUILD_LOG" | grep -v "ERRORLEVEL" | wc -l || echo "0")
  
  if [ "$WARNINGS" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "⚠️  Build completed with issues detected:"
    if [ "$WARNINGS" -gt 0 ]; then
      echo "   ⚠️  Warnings: $WARNINGS"
      # Show unique warnings (avoid duplicates from step numbers like #12)
      grep -i "warning" "$BUILD_LOG" | grep -v "^#" | sed 's/^[0-9#]*[[:space:]]*//' | sort -u | head -5 | sed 's/^/      /'
      if [ "$WARNINGS" -gt 5 ]; then
        echo "      ... and $((WARNINGS - 5)) more warnings"
      fi
    fi
    if [ "$ERRORS" -gt 0 ]; then
      echo "   ❌ Errors: $ERRORS"
      # Show unique errors (avoid duplicates from step numbers like #12)
      grep -i "error" "$BUILD_LOG" | grep -v "ERRORLEVEL" | grep -v "^#" | sed 's/^[0-9#]*[[:space:]]*//' | sort -u | head -5 | sed 's/^/      /'
      if [ "$ERRORS" -gt 5 ]; then
        echo "      ... and $((ERRORS - 5)) more errors"
      fi
    fi
    echo "   📄 Full build log: $BUILD_LOG"
  fi
else
  BUILD_EXIT_CODE=$?
  echo ""
  echo "❌ Build failed with exit code: $BUILD_EXIT_CODE"
  echo ""
  echo "🔍 Errors found in build:"
  grep -i "error" "$BUILD_LOG" | grep -v "ERRORLEVEL" | grep -v "^#" | tail -10 | sed 's/^/   /'
  echo ""
  echo "📄 Full build log: $BUILD_LOG"
  exit $BUILD_EXIT_CODE
fi

# =============================================================================
# SHIP ARTIFACT TO REMOTE SERVER
# =============================================================================
echo "📦 Shipping Docker image to remote server..."
echo "   This may take a few minutes depending on image size and connection speed..."

# Get image size for progress indication
IMAGE_SIZE=$(docker image inspect wms-app --format='{{.Size}}' 2>/dev/null || echo "0")
if [ "$IMAGE_SIZE" != "0" ]; then
  IMAGE_SIZE_MB=$((IMAGE_SIZE / 1024 / 1024))
  echo "   Image size: ~${IMAGE_SIZE_MB} MB"
fi

# Capture transfer output (TRANSFER_LOG already initialized above)

# Transfer image: save -> compress -> transfer -> decompress -> load
# Capture docker errors/warnings, bzip2 progress may be noisy but we'll filter it
if docker save wms-app 2>&1 | bzip2 | ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && bunzip2 | docker load 2>&1" 2>&1 | tee "$TRANSFER_LOG"; then
  TRANSFER_EXIT_CODE=0
else
  TRANSFER_EXIT_CODE=$?
fi

if [ $TRANSFER_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Failed to transfer image to remote server!"
  echo ""
  echo "🔍 Transfer output:"
  cat "$TRANSFER_LOG" | tail -20 | sed 's/^/   /'
  echo ""
  echo "💡 Common issues:"
  echo "   - Network connectivity problems"
  echo "   - Insufficient disk space on remote server"
  echo "   - SSH connection issues"
  exit 1
fi

# Check for warnings in transfer
TRANSFER_WARNINGS=$(grep -i "warning" "$TRANSFER_LOG" | wc -l || echo "0")
if [ "$TRANSFER_WARNINGS" -gt 0 ]; then
  echo ""
  echo "⚠️  Image transfer completed with warnings:"
  grep -i "warning" "$TRANSFER_LOG" | head -3 | sed 's/^/   /'
fi

echo "✅ Image transferred successfully!"

# =============================================================================
# RESTART REMOTE SERVICES
# =============================================================================
echo "🛡️ Enabling maintenance mode on remote server..."
enable_maintenance
echo "✅ Maintenance mode enabled."

echo "🚀 Restarting services on remote server..."

# Use production override if it exists, otherwise use base compose file
COMPOSE_CMD="docker compose up -d"
if ssh ${SSH_OPTS} "${REMOTE_HOST}" "test -f ${REMOTE_DIR}/docker-compose.prod.yml"; then
  COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
  echo "   Using production override (docker-compose.prod.yml)"
else
  echo "   Using base compose file (docker-compose.yml)"
fi

# Capture compose output (COMPOSE_LOG already initialized above)

if ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && $COMPOSE_CMD" 2>&1 | tee "$COMPOSE_LOG"; then
  COMPOSE_EXIT_CODE=0
else
  COMPOSE_EXIT_CODE=$?
fi

if [ $COMPOSE_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Failed to restart services on remote server!"
  echo ""
  echo "🔍 Service restart output:"
  cat "$COMPOSE_LOG" | sed 's/^/   /'
  echo ""
  echo "💡 Check the output above for errors"
  exit 1
fi

# Check for warnings in compose output
COMPOSE_WARNINGS=$(grep -i "warning" "$COMPOSE_LOG" | wc -l || echo "0")
if [ "$COMPOSE_WARNINGS" -gt 0 ]; then
  echo ""
  echo "⚠️  Service restart completed with warnings:"
  grep -i "warning" "$COMPOSE_LOG" | head -5 | sed 's/^/   /'
  if [ "$COMPOSE_WARNINGS" -gt 5 ]; then
    echo "   ... and $((COMPOSE_WARNINGS - 5)) more warnings"
  fi
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Checking service status..."
STATUS_OUTPUT=$(ssh ${SSH_OPTS} "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose ps" 2>&1)
echo "$STATUS_OUTPUT" | sed 's/^/   /'

# Check for unhealthy or exited containers
if echo "$STATUS_OUTPUT" | grep -qE "(unhealthy|exited|restarting)"; then
  echo ""
  echo "⚠️  Warning: Some containers may not be healthy:"
  echo "$STATUS_OUTPUT" | grep -E "(unhealthy|exited|restarting)" | sed 's/^/   ⚠️  /'
  echo ""
  echo "💡 Check container logs for details:"
  echo "   ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && docker compose logs <service-name>'"
fi

echo ""
echo "📋 Next steps on production server:"
echo "   1. Run database migrations (if schema changed):"
echo "      ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && docker compose exec app npx prisma migrate deploy'"
echo ""
echo "   2. Check application logs:"
echo "      ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && docker compose logs -f app'"
echo ""
echo "   3. Verify health endpoint:"
echo "      curl http://${SERVER_IP}:3000/api/health"
echo ""
echo "   4. Check service status:"
echo "      ssh ${SSH_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && docker compose ps'"

