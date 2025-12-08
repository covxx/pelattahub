#!/bin/bash
# Bulletproof script to ensure admin account exists
# This script detects the actual database password and creates/updates admin account
# Run this after any build or when login fails

set -e

EMAIL="${1:-admin@example.com}"
PASSWORD="${2:-admin123}"
NAME="${3:-Admin User}"

echo "=========================================="
echo "🔐 Ensuring Admin Account (Bulletproof)"
echo "=========================================="

# Detect database container and password
DB_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "(wms-db|postgres.*wms)" | head -1)
if [ -z "$DB_CONTAINER" ]; then
    echo "❌ Database container not found"
    exit 1
fi

echo "📦 Database container: $DB_CONTAINER"

# Try to detect password from container env or use common defaults
DB_PASS=$(docker inspect $DB_CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' | grep POSTGRES_PASSWORD | cut -d= -f2 | head -1)

if [ -z "$DB_PASS" ]; then
    # Try common passwords
    for pass in "producebro9" "wms_password" "wms"; do
        if docker exec $DB_CONTAINER psql -U wms -d wms -c "SELECT 1;" > /dev/null 2>&1 <<< "\\password $pass" 2>/dev/null || \
           PGPASSWORD=$pass docker exec -e PGPASSWORD=$pass $DB_CONTAINER psql -U wms -d wms -c "SELECT 1;" > /dev/null 2>&1; then
            DB_PASS=$pass
            break
        fi
    done
fi

if [ -z "$DB_PASS" ]; then
    echo "⚠️  Could not detect password, trying default: wms_password"
    DB_PASS="wms_password"
fi

echo "🔑 Using database password: ${DB_PASS:0:3}***"

# Generate password hash
echo ""
echo "📝 Generating password hash..."
HASH=$(docker run --rm --network wms_wms-network node:20-alpine sh -c "
  apk add --no-cache python3 make g++ > /dev/null 2>&1
  npm install -g bcryptjs > /dev/null 2>&1
  node -e \"const bcrypt = require('bcryptjs'); bcrypt.hash('$PASSWORD', 10).then(hash => console.log(hash));\"
" 2>/dev/null | tail -1)

if [ -z "$HASH" ] || [ ${#HASH} -lt 50 ]; then
    echo "❌ Failed to generate hash, using fallback method..."
    # Fallback: Use Node.js directly if available
    HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hashSync('$PASSWORD', 10)" 2>/dev/null || echo "")
fi

if [ -z "$HASH" ] || [ ${#HASH} -lt 50 ]; then
    echo "❌ CRITICAL: Could not generate password hash"
    exit 1
fi

echo "✅ Hash generated (${#HASH} chars)"

# Create/Update admin account
echo ""
echo "💾 Creating/updating admin account..."
PGPASSWORD=$DB_PASS docker exec -e PGPASSWORD=$DB_PASS $DB_CONTAINER psql -U wms -d wms <<EOF > /dev/null 2>&1
DELETE FROM users WHERE email = '$EMAIL';
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

if [ $? -ne 0 ]; then
    # Try without PGPASSWORD env var
    docker exec $DB_CONTAINER psql -U wms -d wms <<EOF > /dev/null 2>&1
DELETE FROM users WHERE email = '$EMAIL';
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
fi

# Verify
VERIFY=$(docker exec $DB_CONTAINER psql -U wms -d wms -t -c "SELECT email || ' | ' || role FROM users WHERE email = '$EMAIL';" 2>/dev/null | tr -d ' ')

if [ -n "$VERIFY" ]; then
    echo "✅ Admin account verified: $VERIFY"
    echo ""
    echo "=========================================="
    echo "📋 Login Credentials"
    echo "=========================================="
    echo "   Email: $EMAIL"
    echo "   Password: $PASSWORD"
    echo "   Role: ADMIN"
    echo ""
    echo "✅ Ready to login at http://localhost:3000/login"
    echo "=========================================="
    exit 0
else
    echo "❌ CRITICAL: Account verification failed"
    exit 1
fi

