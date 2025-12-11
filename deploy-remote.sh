#!/bin/bash

# Remote Deployment Script
# Builds Docker image locally and ships it to the remote server
# This prevents OOM crashes on the VPS by building on a machine with more RAM

# =============================================================================
# CONFIGURATION
# =============================================================================
# Set your Hetzner VPS IP address here
SERVER_IP="YOUR_HETZNER_IP_HERE"

# Set the SSH user (typically 'root' for VPS)
SSH_USER="root"

# Set the remote project directory
REMOTE_DIR="~/opt/pelattahub"

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
docker build --platform linux/amd64 -t wms-app .

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

docker save wms-app | bzip2 | ssh ${SSH_USER}@${SERVER_IP} "cd ${REMOTE_DIR} && bunzip2 | docker load"

if [ $? -ne 0 ]; then
  echo "❌ Failed to transfer image to remote server!"
  exit 1
fi

echo "✅ Image transferred successfully!"

# =============================================================================
# RESTART REMOTE SERVICES
# =============================================================================
echo "🚀 Restarting services on remote server..."

ssh ${SSH_USER}@${SERVER_IP} "cd ${REMOTE_DIR} && docker compose up -d"

if [ $? -ne 0 ]; then
  echo "❌ Failed to restart services on remote server!"
  exit 1
fi

echo "✅ Deployment complete!"
echo ""
echo "📊 Checking service status..."
ssh ${SSH_USER}@${SERVER_IP} "cd ${REMOTE_DIR} && docker compose ps"

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

