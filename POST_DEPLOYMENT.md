# Post-Deployment Checklist

After running `./deploy-remote.sh`, follow these steps on the production server to ensure everything is working correctly.

## 🔍 1. Verify Service Status

```bash
# SSH into production server
ssh root@YOUR_SERVER_IP

# Navigate to project directory
cd /root/wms

# Check if all services are running
docker compose ps
```

**Expected output:** All services should show "Up" status.

---

## 🗄️ 2. Run Database Migrations (If Schema Changed)

If you've made database schema changes, run migrations:

```bash
# On production server
cd /root/wms
docker compose exec app npx prisma migrate deploy
```

**Note:** This is safe to run even if no migrations are pending - it will simply report that the database is up to date.

---

## 📋 3. Check Application Logs

Verify the application started correctly:

```bash
# View recent logs
docker compose logs --tail=50 app

# Follow logs in real-time (Ctrl+C to exit)
docker compose logs -f app
```

**Look for:**
- ✅ "Ready" message from Next.js
- ✅ No error messages
- ✅ Database connection successful

---

## 🏥 4. Verify Health Endpoint

Test the application health check:

```bash
# From your local machine or production server
curl http://YOUR_SERVER_IP:3000/api/health
```

**Expected response:**
```json
{"status":"ok"}
```

If you get `{"status":"error"}`, check the logs for database connection issues.

---

## 🔄 5. Restart Services (If Needed)

If you notice any issues, restart the services:

```bash
# On production server
cd /root/wms

# Restart all services
docker compose restart

# Or restart just the app
docker compose restart app
```

---

## 🧹 6. Clean Up Old Images (Optional)

After confirming the new deployment works, you can remove old Docker images to free up disk space:

```bash
# On production server
docker image prune -a

# Or remove specific old images
docker images | grep wms-app
docker rmi <old-image-id>
```

**Warning:** Only do this after confirming the new deployment is working!

---

## 🐛 Troubleshooting

### Application won't start

```bash
# Check logs
docker compose logs app

# Check if port 3000 is in use
netstat -tulpn | grep 3000

# Verify environment variables
docker compose exec app env | grep DATABASE_URL
```

### Database connection errors

```bash
# Verify database is running (if using docker-compose for DB)
docker compose ps db

# Test database connection
docker compose exec app npx prisma db pull
```

### Health check failing

```bash
# Check if the app container is healthy
docker inspect wms-app --format='{{.State.Health.Status}}'

# View health check logs
docker inspect wms-app --format='{{json .State.Health}}' | jq
```

---

## 📊 Quick Status Check Script

Create this script on the production server for quick status checks:

```bash
# Save as /root/wms/check-status.sh
#!/bin/bash
echo "=== Service Status ==="
docker compose ps

echo ""
echo "=== Recent App Logs ==="
docker compose logs --tail=20 app

echo ""
echo "=== Health Check ==="
curl -s http://localhost:3000/api/health || echo "Health check failed"
```

Make it executable:
```bash
chmod +x /root/wms/check-status.sh
```

Run it:
```bash
./check-status.sh
```

---

## ✅ Deployment Complete When:

- [ ] All services show "Up" status
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] No errors in application logs
- [ ] Database migrations completed (if any)
- [ ] Application is accessible via browser

