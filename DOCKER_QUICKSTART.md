# 🐳 Docker Quick Start - 3 Commands

## Step 1: Create .env File

```bash
# Generate secret
openssl rand -base64 32
```

Copy the output, then create `.env`:

```bash
cat > .env << 'EOF'
POSTGRES_USER=wms
POSTGRES_PASSWORD=wms_secure_password_123
POSTGRES_DB=wms

# CRITICAL: Use "db" as hostname (NOT "localhost")
DATABASE_URL="postgresql://wms:wms_secure_password_123@db:5432/wms?schema=public"

NEXTAUTH_SECRET="PASTE_YOUR_SECRET_HERE"
NEXTAUTH_URL="http://localhost:3000"

NEXT_PUBLIC_COMPANY_NAME="Fresh Farm Logic LLC"
NEXT_PUBLIC_COMPANY_ADDRESS="1234 Produce Lane, Salinas, CA"

NODE_ENV="production"
EOF
```

Replace `PASTE_YOUR_SECRET_HERE` with your generated secret!

---

## Step 2: Build & Start

```bash
docker-compose up -d --build
```

Wait 30-60 seconds for migrations to complete.

---

## Step 3: Seed Database

```bash
docker-compose exec app npm run db:seed
```

---

## ✅ Done!

Open: **http://localhost:3000**

Login:
- **Email**: `admin@freshproduce.com`
- **Password**: `admin123`

---

## 📊 Key Points

### ⚠️ DATABASE_URL Host

**Use `db` (service name), NOT `localhost`:**

```env
✅ CORRECT: DATABASE_URL="postgresql://wms:pass@db:5432/wms?schema=public"
❌ WRONG:   DATABASE_URL="postgresql://wms:pass@localhost:5432/wms?schema=public"
```

### 📁 Data Persistence

Your database data is stored in `./pgdata/`:
- Survives container restarts
- Survives `docker-compose down`
- To reset: `rm -rf pgdata && docker-compose up -d --build`

---

## 🔧 Useful Commands

```bash
# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Restart
docker-compose restart

# Access database
docker-compose exec db psql -U wms -d wms

# Run Prisma Studio
docker-compose exec app npx prisma studio
```

---

## 🌐 Deploy to Server

```bash
# 1. Install Docker
sudo apt update && sudo apt install docker.io docker-compose -y

# 2. Upload project
scp -r /Users/cj/wms username@server:/home/username/

# 3. SSH and create .env
ssh username@server
cd wms
nano .env  # Update NEXTAUTH_URL with server IP

# 4. Start
docker-compose up -d --build
docker-compose exec app npm run db:seed
```

---

See **DOCKER_DEPLOYMENT.md** for complete documentation.

