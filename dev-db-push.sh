#!/bin/bash

echo "🔄 Pushing DB Schema..."

# 1. Push changes to DB (Fast dev mode, not migration history)
docker compose exec -T app ./node_modules/.bin/prisma db push

echo "⚡ Generating Client..."

# 2. Update the TypeScript client inside the container
docker compose exec -T app ./node_modules/.bin/prisma generate

echo "♻️ Restarting App..."

# 3. Quick restart of the node process to pick up new types
docker compose restart app

echo "✅ Done! Refresh your browser."












