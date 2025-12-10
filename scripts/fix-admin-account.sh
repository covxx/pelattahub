#!/bin/bash
# Bulletproof script to fix admin account and verify auth system
# Run this after any build or deployment to ensure admin access works

set -e

echo "=========================================="
echo "🔐 Fixing Admin Account & Auth System"
echo "=========================================="

EMAIL="admin@example.com"
PASSWORD="admin123"
NAME="Admin User"

# Step 1: Generate password hash
echo ""
echo "Step 1: Generating password hash..."
HASH=$(docker run --rm --network wms_wms-network node:20-alpine sh -c "
  apk add --no-cache python3 make g++ > /dev/null 2>&1
  npm install -g bcryptjs > /dev/null 2>&1
  node -e \"const bcrypt = require('bcryptjs'); bcrypt.hash('$PASSWORD', 10).then(hash => console.log(hash));\"
" 2>/dev/null | tail -1)

if [ -z "$HASH" ] || [ ${#HASH} -lt 50 ]; then
    echo "❌ Failed to generate hash"
    exit 1
fi

echo "✅ Hash generated (${#HASH} chars)"

# Step 2: Update/Create admin account
echo ""
echo "Step 2: Ensuring admin account exists..."
docker exec 71950ecfa4c1_wms-db psql -U wms -d wms <<EOF > /dev/null 2>&1
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

if [ $? -eq 0 ]; then
    echo "✅ Admin account created/updated"
else
    echo "❌ Failed to create admin account"
    exit 1
fi

# Step 3: Verify account
echo ""
echo "Step 3: Verifying account..."
VERIFY=$(docker exec 71950ecfa4c1_wms-db psql -U wms -d wms -t -c "SELECT email, role FROM users WHERE email = '$EMAIL';" 2>/dev/null | tr -d ' ')

if [ -n "$VERIFY" ]; then
    echo "✅ Account verified: $VERIFY"
else
    echo "❌ Account verification failed"
    exit 1
fi

# Step 4: Test password hash
echo ""
echo "Step 4: Testing password hash..."
TEST_RESULT=$(docker run --rm --network wms_wms-network node:20-alpine sh -c "
  apk add --no-cache python3 make g++ > /dev/null 2>&1
  npm install -g bcryptjs > /dev/null 2>&1
  node -e \"
    const bcrypt = require('bcryptjs');
    bcrypt.compare('$PASSWORD', '$HASH').then(result => {
      console.log(result ? 'VALID' : 'INVALID');
      process.exit(result ? 0 : 1);
    });
  \"
" 2>/dev/null | tail -1)

if [ "$TEST_RESULT" = "VALID" ]; then
    echo "✅ Password hash is valid"
else
    echo "❌ Password hash validation failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Admin Account Setup Complete!"
echo "=========================================="
echo "   Email: $EMAIL"
echo "   Password: $PASSWORD"
echo "   Role: ADMIN"
echo ""
echo "You can now log in at http://localhost:3000/login"
echo "=========================================="

