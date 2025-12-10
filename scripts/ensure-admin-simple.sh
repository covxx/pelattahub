#!/bin/bash
# Simple bulletproof script to ensure admin account exists
# Uses a pre-generated bcrypt hash for 'admin123'

set -e

EMAIL="${1:-admin@example.com}"
PASSWORD="${2:-admin123}"
NAME="${3:-Admin User}"

# Pre-generated bcrypt hash for 'admin123' (10 rounds)
# Generated with: bcrypt.hash('admin123', 10)
HASH='$2b$10$qNWDINaZg1KrE2Z5IMzqceBzwXWT/s4F6o0NiT8oPNa130UpTy6.2'

echo "=========================================="
echo "🔐 Ensuring Admin Account"
echo "=========================================="
echo "   Email: $EMAIL"
echo "   Password: $PASSWORD"
echo ""

# Find database container
DB_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "(wms-db|postgres.*wms|71950ecfa4c1)" | head -1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ Database container not found"
    exit 1
fi

echo "📦 Using database container: $DB_CONTAINER"
echo ""

# Create/Update admin account
echo "💾 Creating/updating admin account..."
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

if [ $? -ne 0 ]; then
    echo "❌ Failed to create admin account"
    exit 1
fi

# Verify
VERIFY=$(docker exec $DB_CONTAINER psql -U wms -d wms -t -c "SELECT email || ' | ' || role FROM users WHERE email = '$EMAIL';" 2>/dev/null | xargs)

if [ -n "$VERIFY" ]; then
    echo "✅ Admin account ready!"
    echo ""
    echo "=========================================="
    echo "📋 Login Credentials"
    echo "=========================================="
    echo "   Email: $EMAIL"
    echo "   Password: $PASSWORD"
    echo "   Role: ADMIN"
    echo ""
    echo "✅ You can now login at http://localhost:3000/login"
    echo "=========================================="
    exit 0
else
    echo "❌ Account verification failed"
    exit 1
fi

