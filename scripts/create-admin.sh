#!/bin/bash
# Script to create an admin user in the WMS database

EMAIL="${1:-admin@example.com}"
PASSWORD="${2:-admin123}"
NAME="${3:-Admin User}"

echo "Creating admin account..."
echo "   Email: $EMAIL"
echo "   Name: $NAME"
echo "   Password: $PASSWORD"
echo ""

# Generate bcrypt hash (using Node.js in a temporary container)
HASH=$(docker run --rm --network wms_wms-network node:20-alpine sh -c "
  apk add --no-cache python3 make g++ > /dev/null 2>&1
  npm install -g bcryptjs > /dev/null 2>&1
  node -e \"const bcrypt = require('bcryptjs'); bcrypt.hash('$PASSWORD', 10).then(hash => console.log(hash));\"
" 2>/dev/null | tail -1)

if [ -z "$HASH" ]; then
  echo "❌ Failed to generate password hash"
  exit 1
fi

# Insert/update user in database
docker exec 71950ecfa4c1_wms-db psql -U wms -d wms <<EOF
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
  echo "✅ Admin user created successfully!"
  echo ""
  echo "📋 Login Credentials:"
  echo "   Email: $EMAIL"
  echo "   Password: $PASSWORD"
  echo "   Role: ADMIN"
else
  echo "❌ Failed to create admin user"
  exit 1
fi

