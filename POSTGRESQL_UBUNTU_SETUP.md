# PostgreSQL Setup on Ubuntu Server

## 🐘 Complete PostgreSQL Installation Guide

### Step 1: Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install PostgreSQL

```bash
# Install PostgreSQL and contrib package
sudo apt install postgresql postgresql-contrib -y
```

This installs:
- PostgreSQL server
- PostgreSQL client
- Additional utilities and extensions

### Step 3: Verify Installation

```bash
# Check PostgreSQL version
psql --version

# Check if PostgreSQL service is running
sudo systemctl status postgresql

# If not running, start it:
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Enable auto-start on boot
```

---

## 👤 Step 4: Create Database and User

### Switch to PostgreSQL User

```bash
sudo -i -u postgres
```

You're now in the `postgres` user shell.

### Create the Database

```bash
# Launch PostgreSQL interactive terminal
psql

# You should see: postgres=#
```

Now run these SQL commands:

```sql
-- Create a new database
CREATE DATABASE wms;

-- Create a user with password (CHANGE 'your_secure_password')
CREATE USER wms_user WITH ENCRYPTED PASSWORD 'your_secure_password';

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE wms TO wms_user;

-- Connect to the wms database
\c wms

-- Grant schema privileges (PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO wms_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wms_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO wms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO wms_user;

-- Verify the database was created
\l

-- Exit psql
\q
```

### Exit PostgreSQL User

```bash
exit  # Back to your regular user
```

---

## 🔒 Step 5: Configure PostgreSQL for Remote Access (Optional)

If you want to connect from your local machine or other servers:

### Edit PostgreSQL Configuration

```bash
# Find your PostgreSQL version
ls /etc/postgresql/

# Edit postgresql.conf (replace 14 with your version)
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Find this line:
```
#listen_addresses = 'localhost'
```

Change it to:
```
listen_addresses = '*'
```

Save and exit (Ctrl+X, Y, Enter)

### Edit Client Authentication

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Add this line at the end:
```
# Allow remote connections (for specific IP or all)
host    wms             wms_user        0.0.0.0/0               md5
```

For more security, replace `0.0.0.0/0` with your specific IP:
```
host    wms             wms_user        YOUR_IP_ADDRESS/32      md5
```

Save and exit.

### Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

### Open Firewall Port (if using UFW)

```bash
# Allow PostgreSQL port
sudo ufw allow 5432/tcp

# Check firewall status
sudo ufw status
```

---

## ✅ Step 6: Test the Connection

### Test Locally on Ubuntu Server

```bash
# Test connection with the new user
psql -U wms_user -d wms -h localhost

# Enter the password when prompted
# You should see: wms=>

# Exit
\q
```

### Test from Your Local Machine (Mac)

First, install PostgreSQL client on your Mac if not already installed:

```bash
# Using Homebrew
brew install postgresql
```

Then test the connection:

```bash
# Replace SERVER_IP with your Ubuntu server's IP address
psql -U wms_user -d wms -h SERVER_IP

# Enter password when prompted
```

---

## 🔗 Step 7: Get Your Connection String

Based on your setup, your connection string will be:

### Local Connection (on the Ubuntu server itself)
```
DATABASE_URL="postgresql://wms_user:your_secure_password@localhost:5432/wms?schema=public"
```

### Remote Connection (from another machine)
```
DATABASE_URL="postgresql://wms_user:your_secure_password@YOUR_SERVER_IP:5432/wms?schema=public"
```

---

## 🚀 Step 8: Deploy Your Next.js App

### Option A: Running Directly on Ubuntu Server

```bash
# 1. Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# 2. Clone/upload your WMS project to the server
# (If using git)
git clone YOUR_REPO_URL
cd wms

# Or upload via scp from your Mac:
# scp -r /Users/cj/wms username@server_ip:/home/username/

# 3. Create .env file on server
nano .env

# Paste this (update with your actual password):
DATABASE_URL="postgresql://wms_user:your_secure_password@localhost:5432/wms?schema=public"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://YOUR_SERVER_IP:3000"
NEXT_PUBLIC_COMPANY_NAME="Fresh Farm Logic LLC"
NEXT_PUBLIC_COMPANY_ADDRESS="1234 Produce Lane, Salinas, CA"
NODE_ENV="production"

# 4. Install dependencies
npm install

# 5. Run Prisma migrations
npx prisma generate
npx prisma migrate deploy

# 6. Seed the database
npm run db:seed

# 7. Build the app
npm run build

# 8. Start the app
npm start
# Or use PM2 for production:
sudo npm install -g pm2
pm2 start npm --name "wms" -- start
pm2 save
pm2 startup
```

### Option B: Using Docker (Recommended for Production)

See the `SETUP_INSTRUCTIONS.md` Docker section for containerized deployment.

---

## 🔧 Useful PostgreSQL Commands

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Stop PostgreSQL
sudo systemctl stop postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Connect to PostgreSQL
sudo -u postgres psql

# List all databases
sudo -u postgres psql -c "\l"

# List all users
sudo -u postgres psql -c "\du"

# Backup database
pg_dump -U wms_user -d wms -h localhost > wms_backup.sql

# Restore database
psql -U wms_user -d wms -h localhost < wms_backup.sql
```

---

## 🐛 Troubleshooting

### Error: "Peer authentication failed"

Edit pg_hba.conf:
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Change:
```
local   all             all                                     peer
```

To:
```
local   all             all                                     md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Error: "Could not connect to server"

Check if PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

Check if port 5432 is listening:
```bash
sudo netstat -plunt | grep 5432
```

### Error: "Permission denied for schema public"

Run these as postgres user:
```bash
sudo -u postgres psql wms
```

```sql
GRANT ALL ON SCHEMA public TO wms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO wms_user;
```

---

## 📊 Quick Setup Summary

```bash
# 1. Install PostgreSQL
sudo apt update && sudo apt install postgresql postgresql-contrib -y

# 2. Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE wms;
CREATE USER wms_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE wms TO wms_user;
\c wms
GRANT ALL ON SCHEMA public TO wms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO wms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO wms_user;
\q
EOF

# 3. Test connection
psql -U wms_user -d wms -h localhost

# 4. Your connection string:
# DATABASE_URL="postgresql://wms_user:your_secure_password@localhost:5432/wms?schema=public"
```

---

## 🎯 Next Steps

1. ✅ Complete PostgreSQL installation
2. ✅ Create database and user
3. ✅ Get your connection string
4. 📝 Update `.env` file with the connection string
5. 🚀 Run `npx prisma migrate dev`
6. 🌱 Run `npm run db:seed`
7. 🎉 Start your app with `npm run dev`

Your WMS will be ready to track fresh produce inventory! 🍎🥬📦

