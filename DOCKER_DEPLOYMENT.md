# 🐳 Docker Deployment Guide

## ✅ What's Been Set Up

Your WMS now has a complete Docker setup with:
- ✅ **Multi-stage Dockerfile** (deps → builder → runner) for optimized images
- ✅ **docker-compose.yml** with 3 services:
  - `db` - PostgreSQL 15 Alpine
  - `prisma-migrate` - Auto-runs migrations on startup
  - `app` - Next.js application
- ✅ **Data persistence** via `./pgdata` volume mapping
- ✅ **Health checks** for database and app

---

## 🚀 Quick Start (3 Steps)

### Step 1: Create Your .env File

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32
```

Copy the output, then create `.env`:

```bash
cat > .env << 'EOF'
# PostgreSQL Configuration
POSTGRES_USER=wms
POSTGRES_PASSWORD=wms_secure_password_123
POSTGRES_DB=wms

# DATABASE_URL - CRITICAL: Use "db" as hostname (service name)
DATABASE_URL="postgresql://wms:wms_secure_password_123@db:5432/wms?schema=public"

# NextAuth (paste your generated secret)
NEXTAUTH_SECRET="PASTE_YOUR_GENERATED_SECRET_HERE"
NEXTAUTH_URL="http://localhost:3000"

# Company Info
NEXT_PUBLIC_COMPANY_NAME="Fresh Farm Logic LLC"
NEXT_PUBLIC_COMPANY_ADDRESS="1234 Produce Lane, Salinas, CA"

NODE_ENV="production"
EOF
```

**Replace `PASTE_YOUR_GENERATED_SECRET_HERE` with your actual secret!**

### Step 2: Build and Start

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### Step 3: Seed the Database

```bash
# Wait for migrations to complete (check logs)
docker-compose logs prisma-migrate

# Once migrations are done, seed the database
docker-compose exec app npx prisma db seed
# OR
docker-compose exec app npm run db:seed
```

**Your WMS is now running at http://localhost:3000** 🎉

---

## 📊 Understanding the DATABASE_URL

### ⚠️ CRITICAL: Why "db" and not "localhost"?

In Docker Compose, containers communicate via an internal network using **service names as hostnames**.

**WRONG ❌:**
```env
DATABASE_URL="postgresql://wms:password@localhost:5432/wms"
```
This won't work! The app container can't connect to "localhost:5432".

**CORRECT ✅:**
```env
DATABASE_URL="postgresql://wms:password@db:5432/wms?schema=public"
```
The hostname `db` matches the service name in `docker-compose.yml`.

### Service Name Breakdown

```yaml
services:
  db:              # ← This is the hostname
    image: postgres:15-alpine
```

When the `app` container needs to connect to PostgreSQL, it uses `db:5432`.

---

## 🗂️ Data Persistence with ./pgdata

Your database data is stored in `./pgdata` directory:

```yaml
volumes:
  - ./pgdata:/var/lib/postgresql/data
```

**What this means:**
- ✅ Data survives container restarts
- ✅ Data survives `docker-compose down`
- ✅ Can backup by copying `./pgdata` folder
- ⚠️ Add `pgdata/` to `.gitignore` (don't commit data!)

**To reset database:**
```bash
docker-compose down
rm -rf pgdata
docker-compose up -d --build
```

---

## 🔧 Useful Docker Commands

### Starting & Stopping

```bash
# Start all services (detached)
docker-compose up -d

# Start and rebuild
docker-compose up -d --build

# Stop all services (keeps data)
docker-compose down

# Stop and remove volumes (WARNING: deletes data!)
docker-compose down -v

# Restart a specific service
docker-compose restart app
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db

# Last 100 lines
docker-compose logs --tail=100 app
```

### Executing Commands

```bash
# Run Prisma commands
docker-compose exec app npx prisma studio
docker-compose exec app npx prisma migrate dev

# Seed database
docker-compose exec app npm run db:seed

# Access PostgreSQL shell
docker-compose exec db psql -U wms -d wms

# Access app shell
docker-compose exec app sh
```

### Checking Status

```bash
# List running containers
docker-compose ps

# Check health status
docker inspect wms-app --format='{{.State.Health.Status}}'

# View resource usage
docker stats
```

---

## 🌐 Deploying to Ubuntu Server

### Option A: Docker Compose on Server

```bash
# 1. Install Docker & Docker Compose
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker

# 2. Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in

# 3. Upload your project
scp -r /Users/cj/wms username@server_ip:/home/username/

# 4. SSH into server
ssh username@server_ip

# 5. Navigate to project
cd wms

# 6. Create .env file (with your secrets)
nano .env

# 7. Update NEXTAUTH_URL with server IP
NEXTAUTH_URL="http://YOUR_SERVER_IP:3000"

# 8. Build and start
docker-compose up -d --build

# 9. Seed database
docker-compose exec app npm run db:seed

# 10. Check logs
docker-compose logs -f
```

### Option B: Individual Docker Commands

```bash
# Create network
docker network create wms-network

# Start PostgreSQL
docker run -d \
  --name wms-db \
  --network wms-network \
  -e POSTGRES_USER=wms \
  -e POSTGRES_PASSWORD=wms_password \
  -e POSTGRES_DB=wms \
  -v $(pwd)/pgdata:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15-alpine

# Build app image
docker build -t wms-app .

# Run migrations
docker run --rm \
  --network wms-network \
  -e DATABASE_URL="postgresql://wms:wms_password@wms-db:5432/wms?schema=public" \
  -v $(pwd):/app \
  node:20-alpine \
  sh -c "cd /app && npm install && npx prisma migrate deploy"

# Start app
docker run -d \
  --name wms-app \
  --network wms-network \
  -e DATABASE_URL="postgresql://wms:wms_password@wms-db:5432/wms?schema=public" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -p 3000:3000 \
  wms-app
```

---

## 🔒 Production Security Checklist

- [ ] Use strong passwords in `.env`
- [ ] Never commit `.env` to git
- [ ] Change default `POSTGRES_PASSWORD`
- [ ] Use secrets management (Docker Swarm secrets, Kubernetes secrets)
- [ ] Set up HTTPS with reverse proxy (Nginx/Traefik)
- [ ] Configure firewall rules
- [ ] Regularly backup `./pgdata`
- [ ] Update NEXTAUTH_URL to your domain
- [ ] Use environment-specific .env files

---

## 📦 Backup & Restore

### Backup Database

```bash
# Backup to SQL file
docker-compose exec db pg_dump -U wms -d wms > backup_$(date +%Y%m%d_%H%M%S).sql

# Or backup the entire pgdata folder
tar -czf pgdata_backup_$(date +%Y%m%d_%H%M%S).tar.gz pgdata/
```

### Restore Database

```bash
# From SQL file
docker-compose exec -T db psql -U wms -d wms < backup.sql

# Or restore pgdata folder
docker-compose down
rm -rf pgdata
tar -xzf pgdata_backup_YYYYMMDD_HHMMSS.tar.gz
docker-compose up -d
```

---

## 🐛 Troubleshooting

### App can't connect to database

**Check 1:** Is database service running?
```bash
docker-compose ps
```

**Check 2:** Is DATABASE_URL using "db" as hostname?
```bash
grep DATABASE_URL .env
# Should show: DATABASE_URL="postgresql://...@db:5432/..."
```

**Check 3:** View database logs
```bash
docker-compose logs db
```

### Port already in use

```bash
# Check what's using port 3000 or 5432
lsof -i :3000
lsof -i :5432

# Stop the conflicting service or change port in docker-compose.yml
```

### Migrations not running

```bash
# Check migration service logs
docker-compose logs prisma-migrate

# Manually run migrations
docker-compose exec app npx prisma migrate deploy
```

### Permission denied on pgdata

```bash
# Fix permissions
sudo chown -R $USER:$USER pgdata/
# Or run with sudo
sudo docker-compose up -d
```

### Database data lost after restart

**Check:** Is `./pgdata` mounted correctly?
```bash
docker-compose exec db ls -la /var/lib/postgresql/data
```

If empty, check your `docker-compose.yml` volumes section.

---

## 📊 Architecture Overview

```
┌─────────────────┐
│   Browser       │
│  :3000          │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│   Docker Host           │
│                         │
│  ┌──────────────────┐   │
│  │  wms-app         │   │
│  │  (Next.js)       │   │
│  │  Port: 3000      │◄──┼─── Exposed to host
│  └────────┬─────────┘   │
│           │             │
│           │ connects    │
│           │ via "db"    │
│           ▼             │
│  ┌──────────────────┐   │
│  │  wms-db          │   │
│  │  (PostgreSQL)    │   │
│  │  Port: 5432      │◄──┼─── Exposed to host
│  └────────┬─────────┘   │
│           │             │
│           ▼             │
│     [./pgdata]          │ ◄─ Persistent Volume
│                         │
└─────────────────────────┘
```

---

## 🎯 Next Steps

1. ✅ Create `.env` file with correct DATABASE_URL
2. ✅ Run `docker-compose up -d --build`
3. ✅ Seed database with `docker-compose exec app npm run db:seed`
4. ✅ Login with `admin@freshproduce.com` / `admin123`
5. 🚀 Start receiving inventory!

---

## 📞 Support Commands

```bash
# Complete reset and fresh start
docker-compose down
rm -rf pgdata node_modules .next
docker-compose up -d --build
docker-compose exec app npm run db:seed

# View all environment variables in app
docker-compose exec app env

# Test database connection from app
docker-compose exec app npx prisma db pull
```

**Your Dockerized WMS is ready! 🐳📦**

