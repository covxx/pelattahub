#!/bin/bash

# Maintenance Mode Control Script
# Enables or disables maintenance mode on the production server
# Usage: ./scripts/maintenance.sh [enable|disable|status] [remote|local]
#   - enable: Enable maintenance mode
#   - disable: Disable maintenance mode
#   - status: Check current maintenance mode status
#   - remote: Operate on remote server (default)
#   - local: Operate on local machine

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAINTENANCE_PATH="/etc/nginx/maintenance.on"

# Remote server configuration
SERVER_IP="${SERVER_IP:-178.156.221.237}"
SSH_USER="${SSH_USER:-root}"
SSH_OPTS="${SSH_OPTS:-}"
REMOTE_HOST="${REMOTE_HOST:-${SSH_USER}@${SERVER_IP}}"

# Parse arguments
ACTION="${1:-status}"
TARGET="${2:-remote}"

# =============================================================================
# FUNCTIONS
# =============================================================================

maintenance_exists() {
  if [ "$TARGET" = "remote" ]; then
    ssh $SSH_OPTS "$REMOTE_HOST" "test -f $MAINTENANCE_PATH" >/dev/null 2>&1
  else
    test -f "$MAINTENANCE_PATH"
  fi
}

enable_maintenance() {
  local result=0
  
  if [ "$TARGET" = "remote" ]; then
    echo -e "${YELLOW}🛡️  Enabling maintenance mode on remote server...${NC}"
    ssh $SSH_OPTS "$REMOTE_HOST" "sudo touch $MAINTENANCE_PATH && sudo systemctl reload nginx" || result=$?
  else
    echo -e "${YELLOW}🛡️  Enabling maintenance mode locally...${NC}"
    sudo touch "$MAINTENANCE_PATH" && sudo systemctl reload nginx || result=$?
  fi

  if [ $result -ne 0 ]; then
    echo -e "${RED}❌ Failed to enable maintenance mode (exit $result)${NC}"
    return $result
  fi

  if ! maintenance_exists; then
    echo -e "${RED}❌ Maintenance flag not present at $MAINTENANCE_PATH after enable attempt${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Maintenance mode enabled${NC}"
  echo -e "${BLUE}   Flag file: $MAINTENANCE_PATH${NC}"
  echo -e "${BLUE}   Nginx reloaded${NC}"
}

disable_maintenance() {
  local result=0
  
  if [ "$TARGET" = "remote" ]; then
    echo -e "${YELLOW}🛡️  Disabling maintenance mode on remote server...${NC}"
    ssh $SSH_OPTS "$REMOTE_HOST" "sudo rm -f $MAINTENANCE_PATH && sudo systemctl reload nginx" || result=$?
  else
    echo -e "${YELLOW}🛡️  Disabling maintenance mode locally...${NC}"
    sudo rm -f "$MAINTENANCE_PATH" && sudo systemctl reload nginx || result=$?
  fi

  if [ $result -ne 0 ]; then
    echo -e "${RED}❌ Failed to disable maintenance mode (exit $result)${NC}"
    return $result
  fi

  if maintenance_exists; then
    echo -e "${RED}❌ Maintenance flag still present at $MAINTENANCE_PATH after disable attempt${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
  echo -e "${BLUE}   Flag file removed${NC}"
  echo -e "${BLUE}   Nginx reloaded${NC}"
}

check_status() {
  if [ "$TARGET" = "remote" ]; then
    echo -e "${BLUE}Checking maintenance mode status on remote server...${NC}"
    echo -e "${BLUE}Server: $REMOTE_HOST${NC}"
  else
    echo -e "${BLUE}Checking maintenance mode status locally...${NC}"
  fi
  echo ""

  if maintenance_exists; then
    echo -e "${YELLOW}⚠️  Maintenance mode is ${RED}ENABLED${NC}"
    echo -e "${BLUE}   Flag file: $MAINTENANCE_PATH${NC}"
    
    if [ "$TARGET" = "remote" ]; then
      local file_info=$(ssh $SSH_OPTS "$REMOTE_HOST" "ls -lh $MAINTENANCE_PATH 2>/dev/null || echo 'File not found'")
      echo -e "${BLUE}   $file_info${NC}"
    else
      ls -lh "$MAINTENANCE_PATH" 2>/dev/null || echo "File not found"
    fi
    return 1
  else
    echo -e "${GREEN}✅ Maintenance mode is ${GREEN}DISABLED${NC}"
    echo -e "${BLUE}   Flag file not present${NC}"
    return 0
  fi
}

show_usage() {
  echo -e "${BLUE}Maintenance Mode Control Script${NC}"
  echo ""
  echo "Usage: $0 [enable|disable|status] [remote|local]"
  echo ""
  echo "Commands:"
  echo "  enable   - Enable maintenance mode"
  echo "  disable  - Disable maintenance mode"
  echo "  status   - Check current maintenance mode status (default)"
  echo ""
  echo "Targets:"
  echo "  remote   - Operate on remote server (default)"
  echo "  local    - Operate on local machine"
  echo ""
  echo "Examples:"
  echo "  $0 status              # Check status on remote server"
  echo "  $0 enable              # Enable maintenance on remote server"
  echo "  $0 disable              # Disable maintenance on remote server"
  echo "  $0 status local         # Check status locally"
  echo "  $0 enable local         # Enable maintenance locally"
  echo ""
  echo "Environment Variables:"
  echo "  SERVER_IP    - Remote server IP (default: 178.156.221.237)"
  echo "  SSH_USER     - SSH user (default: root)"
  echo "  SSH_OPTS     - Additional SSH options"
  echo "  REMOTE_HOST  - Full remote host string (overrides SERVER_IP and SSH_USER)"
}

# =============================================================================
# MAIN
# =============================================================================

# Validate action
case "$ACTION" in
  enable|disable|status)
    ;;
  help|--help|-h)
    show_usage
    exit 0
    ;;
  *)
    echo -e "${RED}❌ Invalid action: $ACTION${NC}"
    echo ""
    show_usage
    exit 1
    ;;
esac

# Validate target
if [ "$TARGET" != "remote" ] && [ "$TARGET" != "local" ]; then
  echo -e "${RED}❌ Invalid target: $TARGET${NC}"
  echo "   Must be 'remote' or 'local'"
  exit 1
fi

# Execute action
case "$ACTION" in
  enable)
    enable_maintenance
    ;;
  disable)
    disable_maintenance
    ;;
  status)
    check_status
    exit $?
    ;;
esac

