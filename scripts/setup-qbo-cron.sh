#!/bin/bash

# Setup script for QBO auto-sync cron job
# This sets up a cron job that calls the /api/cron/qbo-sync endpoint every minute

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if CRON_SECRET is set in .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "❌ Error: .env file not found at $PROJECT_DIR/.env"
  exit 1
fi

CRON_SECRET=$(grep "^CRON_SECRET=" "$PROJECT_DIR/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")

if [ -z "$CRON_SECRET" ] || [ "$CRON_SECRET" = "REPLACE_WITH_SECRET_TOKEN" ]; then
  echo "❌ Error: CRON_SECRET not set in .env file"
  echo ""
  echo "Please add CRON_SECRET to your .env file:"
  echo "  CRON_SECRET=\"$(openssl rand -base64 32)\""
  exit 1
fi

# Get the application URL (default to localhost:3000 if NEXTAUTH_URL not set)
APP_URL=$(grep "^NEXTAUTH_URL=" "$PROJECT_DIR/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "http://localhost:3000")
# Remove trailing slash
APP_URL="${APP_URL%/}"

CRON_ENDPOINT="${APP_URL}/api/cron/qbo-sync"

echo "🔧 Setting up QBO auto-sync cron job..."
echo ""
echo "Configuration:"
echo "  Endpoint: $CRON_ENDPOINT"
echo "  Frequency: Every minute (* * * * *)"
echo ""

# Create the cron command
CRON_CMD="curl -X POST -H \"Authorization: Bearer $CRON_SECRET\" -s -o /dev/null -w \"%{http_code}\" \"$CRON_ENDPOINT\""

# Check if cron job already exists
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -F "$CRON_ENDPOINT" || echo "")

if [ -n "$EXISTING_CRON" ]; then
  echo "⚠️  Cron job already exists:"
  echo "   $EXISTING_CRON"
  echo ""
  read -p "Do you want to replace it? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled. Cron job not updated."
    exit 0
  fi
  # Remove existing cron job
  crontab -l 2>/dev/null | grep -vF "$CRON_ENDPOINT" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "# QBO Invoice Auto-Sync (runs every minute)"; echo "* * * * * $CRON_CMD >> /tmp/qbo-sync-cron.log 2>&1") | crontab -

echo "✅ Cron job installed successfully!"
echo ""
echo "The cron job will:"
echo "  - Run every minute"
echo "  - Call $CRON_ENDPOINT"
echo "  - Log output to /tmp/qbo-sync-cron.log"
echo ""
echo "To view logs:"
echo "  tail -f /tmp/qbo-sync-cron.log"
echo ""
echo "To remove the cron job:"
echo "  crontab -e"
echo "  (then delete the line containing 'qbo-sync')"
echo ""
echo "To test the endpoint manually:"
echo "  curl -X POST -H \"Authorization: Bearer $CRON_SECRET\" \"$CRON_ENDPOINT\""

