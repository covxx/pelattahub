#!/bin/bash
# Post-build setup script - ensures admin account exists
# This should be run after container starts or after builds

echo "🔐 Running post-build admin account setup..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
for i in {1..30}; do
    if docker exec 71950ecfa4c1_wms-db psql -U wms -d wms -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database not ready after 30 seconds"
        exit 1
    fi
    sleep 1
done

# Run the ensure-admin script
./scripts/ensure-admin-simple.sh

echo "✅ Post-build setup complete"

