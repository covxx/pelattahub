# Environment Setup Guide

## 🔐 Generate Your NEXTAUTH_SECRET

Run this command in your terminal to generate a secure random secret:

```bash
openssl rand -base64 32
```

This will output something like: `Xk7Y9Zm3vN8pQ2wR5tU6aS1dF4gH7jK0lM9nB8vC3xZ=`

Copy this value and use it in your `.env` file.

---

## 📝 Complete .env File Template

Create or update your `/Users/cj/wms/.env` file with the following:

```env
# Database Connection
# Update 'username', 'password', and 'wms' with your actual PostgreSQL credentials
DATABASE_URL="postgresql://username:password@localhost:5432/wms?schema=public"

# NextAuth Configuration
# Run: openssl rand -base64 32
NEXTAUTH_SECRET="PASTE_YOUR_GENERATED_SECRET_HERE"
NEXTAUTH_URL="http://localhost:3000"

# Company Information (for ZPL Labels)
NEXT_PUBLIC_COMPANY_NAME="Fresh Farm Logic LLC"
NEXT_PUBLIC_COMPANY_ADDRESS="1234 Produce Lane, Salinas, CA"

# Application Environment
NODE_ENV="development"
```

---

## 🚀 Quick Setup Commands

### Option 1: Manual Edit
```bash
# Open .env file in your editor
nano .env
# or
code .env
```

Then paste the template above and:
1. Replace `username:password@localhost:5432/wms` with your PostgreSQL details
2. Run `openssl rand -base64 32` and paste the output for NEXTAUTH_SECRET

### Option 2: Automated Setup (requires your DB credentials)

```bash
# Generate the secret and create .env file
cat > .env << EOF
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/wms?schema=public"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_COMPANY_NAME="Fresh Farm Logic LLC"
NEXT_PUBLIC_COMPANY_ADDRESS="1234 Produce Lane, Salinas, CA"
NODE_ENV="development"
EOF
```

**Replace `YOUR_USER` and `YOUR_PASSWORD` with your actual PostgreSQL credentials!**

---

## 📊 Common PostgreSQL Connection Strings

### Local PostgreSQL (default user)
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wms?schema=public"
```

### Local PostgreSQL (custom user)
```
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/wms?schema=public"
```

### PostgreSQL in Docker
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wms?schema=public"
```

### Remote PostgreSQL
```
DATABASE_URL="postgresql://user:password@your-server.com:5432/wms?schema=public"
```

---

## ✅ Verify Your Setup

After setting up your `.env` file, test the connection:

```bash
# Test database connection
npx prisma db pull

# If successful, generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database
npm run db:seed
```

---

## 🔍 Troubleshooting

### Error: "DATABASE_URL not found"
- Make sure the `.env` file is in the project root (`/Users/cj/wms/`)
- Check that there are no typos in variable names
- Restart your terminal/IDE after creating `.env`

### Error: "Connection refused"
- Ensure PostgreSQL is running: `pg_isready`
- Check PostgreSQL is listening on port 5432: `lsof -i :5432`
- Try connecting with psql: `psql -U postgres -d wms`

### Error: "Database does not exist"
Create the database first:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE wms;

# Exit
\q
```

---

## 🎯 Expected Result

After setup, your labels will show:
- **Company Name**: Fresh Farm Logic LLC
- **Address**: 1234 Produce Lane, Salinas, CA

Example ZPL output:
```
^FO30,40^A0N,30,30^FDFresh Farm Logic LLC^FS
^FO30,75^A0N,20,20^FD1234 Produce Lane, Salinas, CA^FS
```

