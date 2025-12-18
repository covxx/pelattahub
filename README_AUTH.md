# Authentication System - Bulletproof Setup

## 🔐 Admin Account Management

### Creating Admin Account
If you need to create or reset an admin account, use the TypeScript script:
```bash
docker compose exec app npx tsx scripts/create-admin.ts
```

Or run locally (if you have database access):
```bash
npx tsx scripts/create-admin.ts
```

### Admin Credentials
- **Email:** `admin@example.com`
- **Password:** `admin123`
- **Role:** `ADMIN`

## 🛠️ Database Password Issue

**Problem:** The database container may have been created with a different password than what's in `docker-compose.yml`.

**Solution:** The `docker-compose.yml` now defaults to `producebro9` (the actual password). If your database uses a different password:

1. Check your actual password:
   ```bash
   docker inspect <db-container-name> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep POSTGRES_PASSWORD
   ```

2. Update `.env` file:
   ```env
   POSTGRES_PASSWORD=your_actual_password
   ```

3. Or update `docker-compose.yml` directly

## 🔧 Post-Build Setup

After rebuilding containers, ensure the admin account exists:
```bash
docker compose exec app npx tsx scripts/create-admin.ts
```

This creates/updates the admin account with the default credentials.

## 🚨 Common Issues

### "Invalid login" after rebuild
1. Run: `docker compose exec app npx tsx scripts/create-admin.ts`
2. Verify: Check database connection in container logs
3. Check: DATABASE_URL environment variable matches actual DB password

### Database connection errors
- Verify database container is running: `docker ps | grep wms-db`
- Check DATABASE_URL in app container: `docker exec wms-app env | grep DATABASE_URL`
- Ensure password matches: Compare with actual DB container password

### Password hash issues
- The script uses a pre-generated hash that always works
- No need to generate new hashes - the script handles it

## 📝 Maintenance

The auth system is now:
- ✅ Error-resistant (handles DB connection failures gracefully)
- ✅ Production-ready (reduced debug logging)
- ✅ Case-insensitive email matching
- ✅ Proper error handling

