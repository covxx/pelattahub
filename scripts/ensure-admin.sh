#!/bin/bash
# Bulletproof script to ensure admin account exists with correct password
# This script can be run at any time to guarantee admin access

set -e

EMAIL="${1:-admin@example.com}"
PASSWORD="${2:-admin123}"
NAME="${3:-Admin User}"

echo "=========================================="
echo "🔐 Ensuring Admin Account Exists"
echo "=========================================="
echo "   Email: $EMAIL"
echo "   Name: $NAME"
echo "   Password: $PASSWORD"
echo ""

# Check if we're in Docker or local
if [ -f /.dockerenv ] || [ -n "$DOCKER_CONTAINER" ]; then
    DB_HOST="${DB_HOST:-db}"
    DB_USER="${POSTGRES_USER:-wms}"
    DB_PASS="${POSTGRES_PASSWORD:-wms_password}"
    DB_NAME="${POSTGRES_DB:-wms}"
    PSQL_CMD="psql -h $DB_HOST -U $DB_USER -d $DB_NAME"
else
    # Local execution - use docker exec
    CONTAINER_NAME="${DB_CONTAINER:-71950ecfa4c1_wms-db}"
    PSQL_CMD="docker exec $CONTAINER_NAME psql -U wms -d wms"
fi

# Generate bcrypt hash using Node.js
echo "📝 Generating password hash..."
HASH=$(node -e "
  const bcrypt = require('bcryptjs');
  bcrypt.hash('$PASSWORD', 10).then(hash => {
    console.log(hash);
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
" 2>/dev/null)

if [ -z "$HASH" ] || [ ${#HASH} -lt 50 ]; then
    echo "❌ Failed to generate password hash"
    echo "   Trying alternative method..."
    
    # Alternative: Use a temporary Node container
    HASH=$(docker run --rm --network wms_wms-network node:20-alpine sh -c "
      apk add --no-cache python3 make g++ > /dev/null 2>&1
      npm install -g bcryptjs > /dev/null 2>&1
      node -e \"const bcrypt = require('bcryptjs'); bcrypt.hash('$PASSWORD', 10).then(hash => console.log(hash));\"
    " 2>/dev/null | tail -1)
fi

if [ -z "$HASH" ] || [ ${#HASH} -lt 50 ]; then
    echo "❌ CRITICAL: Could not generate password hash"
    exit 1
fi

echo "✅ Password hash generated (length: ${#HASH})"
echo ""

# Check if user exists
echo "🔍 Checking if user exists..."
USER_EXISTS=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM users WHERE email = '$EMAIL';" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" = "1" ]; then
    echo "   User exists, updating password..."
    $PSQL_CMD <<EOF > /dev/null 2>&1
UPDATE users 
SET 
  password = '$HASH',
  name = '$NAME',
  role = 'ADMIN',
  "updatedAt" = NOW()
WHERE email = '$EMAIL';
EOF
    echo "✅ Admin account updated"
else
    echo "   User does not exist, creating..."
    $PSQL_CMD <<EOF > /dev/null 2>&1
INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '$EMAIL',
  '$NAME',
  '$HASH',
  'ADMIN',
  NOW(),
  NOW()
);
EOF
    echo "✅ Admin account created"
fi

# Verify the account
echo ""
echo "🔍 Verifying account..."
VERIFY=$($PSQL_CMD -t -c "SELECT email, name, role FROM users WHERE email = '$EMAIL';" 2>/dev/null)

if [ -n "$VERIFY" ]; then
    echo "✅ Verification successful!"
    echo ""
    echo "=========================================="
    echo "📋 Admin Account Credentials"
    echo "=========================================="
    echo "   Email: $EMAIL"
    echo "   Password: $PASSWORD"
    echo "   Role: ADMIN"
    echo ""
    echo "✅ Admin account is ready to use!"
    echo "=========================================="
    exit 0
else
    echo "❌ CRITICAL: Account verification failed"
    exit 1
fi

