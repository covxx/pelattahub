# Warehouse Management System (WMS) for Fresh Produce

A modern, web-based Warehouse Management System specifically designed for fresh produce inventory tracking with lot-based management, FIFO (First In, First Out) support, PTI (Produce Traceability Initiative) compliance, and seamless QuickBooks Online integration.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5+ (Strict Mode)
- **Database**: PostgreSQL 15+ via Prisma ORM
- **UI**: Tailwind CSS 4 + Shadcn UI (Radix Primitives)
- **Authentication**: NextAuth.js v5 (Beta)
- **Printing**: Raw ZPL (Browser-Native) & PDF (React-PDF)
- **Infrastructure**: Docker & Docker Compose (Production ready)
- **Integration**: QuickBooks Online API (OAuth 2.0)

## Features

### Core Business Logic

- **Lot-Based Inventory**: All inventory is tracked by specific lots with full traceability
- **FIFO Support**: Automatic sorting by oldest lots first for expiry management
- **PTI Compliance**: PTI-compliant label generation with barcode and voice pick codes (CRC16)
- **Multi-Unit Support**: Handles both CASE and LBS (Pounds) with automatic conversion
- **Role-Based Access Control**:
  - **Admin**: Full system access (Users, Products, Customers, Orders, Settings, Integrations)
  - **Manager**: Most admin features except system logs
  - **Receiver**: Receiving operations and lot creation
  - **Packer**: Picking operations and order fulfillment

### Order Management

- **Sales Order Creation**: Create orders from QuickBooks invoices or manually
- **FIFO Allocation**: Intelligent lot allocation based on expiry dates
- **Picking Interface**: Warehouse-friendly picking workflow with lot validation
- **Order Status Tracking**: Draft → Confirmed → Allocated → Picking → Shipped
- **Order History**: Complete audit trail of all order operations

### QuickBooks Online Integration

- **OAuth 2.0 Authentication**: Secure connection to QuickBooks Online
- **Automated Background Sync**: Continuous synchronization service (configurable intervals)
- **Two-Way Data Sync**:
  - Customers: QBO → WMS
  - Products/Items: QBO → WMS
  - Vendors: QBO → WMS
  - Invoices: QBO → WMS (creates sales orders)
- **Auto-Sync Service**: Background Docker service for continuous synchronization
- **Sync Dashboard**: Admin interface for monitoring and manual sync operations

### Receiving & Inventory

- **Receiving Events**: Batch receiving with multiple products and lots
- **Lot Number Generation**: Automatic lot number generation with configurable format
- **Inventory Adjustments**: Manual quantity adjustments with audit logging
- **Lot History**: Complete traceability of lot movements and status changes
- **Expiry Tracking**: Automatic expiry date management and alerts

### Production Module

- **Production Orders**: Create and manage production batches
- **Lot Tracking**: Track raw materials and finished goods through production
- **Yield Management**: Record production yields and waste

### Reporting & Traceability

- **Recall Reports**: Generate comprehensive recall reports with full lot traceability
- **Audit Logs**: Complete audit trail of all system operations
- **Traceability Explorer**: Search and trace products, lots, and orders across the system

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or remote)

### Installation

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd wms
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/wms?schema=public"

   # NextAuth
   NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-base64-32"
   NEXTAUTH_URL="http://localhost:3000"

   # App
   NODE_ENV="development"
   ```

   To generate a secure `NEXTAUTH_SECRET`, run:
   ```bash
   openssl rand -base64 32
   ```

4. **Set up the database**:
   ```bash
   # Generate Prisma Client
   npx prisma generate

   # Run database migrations
   npx prisma migrate dev

   # Seed the database with sample data (Admin user + 2 products)
   npm run db:seed

   # (Optional) Open Prisma Studio to view/edit data
   npx prisma studio
   ```

   **Default Login Credentials (after seeding):**
   - Email: `admin@freshproduce.com`
   - Password: `admin123`

5. **Run the development server**:
   ```bash
   npm run dev
   ```

6. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema

### Models

- **User**: System users with roles (Admin, Receiver, Packer)
- **Product**: SKU/product catalog
- **InventoryLot**: Core lot-based inventory tracking with:
  - Lot numbers
  - Receiving dates and quantities
  - Expiry dates for FIFO sorting
  - Warehouse locations
  - Status tracking (ACTIVE, DEPLETED, EXPIRED)

### Prisma Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

## Project Structure

```
wms/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── auth/         # NextAuth routes
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
│   └── ui/              # Shadcn UI components
├── lib/                  # Utility libraries
│   ├── auth.ts          # NextAuth configuration
│   ├── prisma.ts        # Prisma client instance
│   └── utils.ts         # Utility functions
├── prisma/              # Prisma files
│   └── schema.prisma    # Database schema
└── types/               # TypeScript type definitions
    └── next-auth.d.ts   # NextAuth type extensions
```

## Current Release

**v1.1 "Orion"** (December 18, 2025)
- QuickBooks Online Auto-Sync Service
- Enhanced Invoice Sync Processing
- Improved deployment and configuration management

See [RELEASE_v1.1.md](./RELEASE_v1.1.md) for full release notes.

## Project Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed information about upcoming features:

- 📱 **Mobile Version** - Native mobile experience for warehouse operations
- 🌙 **Dark Mode** - System-wide dark theme support
- 🛡️ **Food Safety Features** - Enhanced food safety compliance and tracking

## System Status

### ✅ Implemented Features

- ✅ Lot-based inventory tracking with full traceability
- ✅ Receiving operations with batch processing
- ✅ PTI-compliant label generation (ZPL)
- ✅ Order management with FIFO allocation
- ✅ Picking interface with lot validation
- ✅ Production module for batch processing
- ✅ QuickBooks Online integration with auto-sync
- ✅ Customer, product, and vendor management
- ✅ Recall reporting and traceability explorer
- ✅ Comprehensive audit logging
- ✅ Role-based access control (Admin, Manager, Receiver, Packer)
- ✅ System settings and configuration
- ✅ Docker-based deployment

### 🔄 Upcoming Features

See [ROADMAP.md](./ROADMAP.md) for planned features.

## Development

- **Linting**: `npm run lint`
- **Build**: `npm run build`
- **Start Production**: `npm start`

## Docker Deployment

This application is containerized and ready for deployment on a Linux VPS using Docker and Docker Compose.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Ubuntu 20.04+ (or similar Linux distribution)

### Quick Start on Fresh Ubuntu Server

1. **Install Docker and Docker Compose**:
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Add your user to docker group (optional, to run without sudo)
   sudo usermod -aG docker $USER
   newgrp docker

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Clone or upload the project**:
   ```bash
   # If using git
   git clone <your-repo-url> wms
   cd wms

   # Or upload files via SCP/SFTP
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   nano .env
   ```

   Required environment variables:
   ```env
   # Database (used by docker-compose)
   POSTGRES_USER=wms
   POSTGRES_PASSWORD=your_secure_password_here
   POSTGRES_DB=wms
   POSTGRES_PORT=5432

   # Application
   DATABASE_URL=postgresql://wms:your_secure_password_here@db:5432/wms?schema=public
   NEXTAUTH_SECRET=your_secret_key_here_generate_with_openssl_rand_base64_32
   NEXTAUTH_URL=https://your-domain.com
   NODE_ENV=production
   
   # QuickBooks Online Integration (optional)
   QBO_CLIENT_ID=your_qbo_client_id
   QBO_CLIENT_SECRET=your_qbo_client_secret
   QBO_REDIRECT_URI=https://your-domain.com/api/auth/qbo/callback
   QBO_ENVIRONMENT=production
   QBO_AUTO_SYNC_ENABLED=false
   QBO_SYNC_INTERVAL_MINUTES=1
   ```

4. **Generate NEXTAUTH_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

5. **Build and start containers**:
   ```bash
   # Build and start all services
   docker compose up -d --build

   # View logs
   docker compose logs -f

   # Check status
   docker compose ps
   ```

### Remote Deployment (Recommended for VPS)

For VPS servers with limited RAM (e.g., 4GB Hetzner VPS), building Docker images directly on the server can cause Out-of-Memory (OOM) crashes. Use the `deploy-remote.sh` script to build locally and ship the image to the server.

**Prerequisites:**
- SSH access to the root user on the VPS
- Docker installed locally (on your development machine)
- `bzip2` installed locally (usually pre-installed on Linux/macOS)

**Usage:**

1. **Edit the script** to set your server IP:
   ```bash
   nano deploy-remote.sh
   # Set SERVER_IP="your.hetzner.ip.address"
   ```

2. **Run the deployment script**:
   ```bash
   ./deploy-remote.sh
   ```

The script will:
- Build the Docker image locally (forcing `linux/amd64` platform for VPS compatibility)
- Compress and transfer the image to the remote server via SSH
- Load the image on the remote server without using server RAM for building
- Restart the Docker Compose services

**Note:** This method requires SSH access configured (typically using SSH keys). Ensure your SSH key is added to the server's `~/.ssh/authorized_keys` file.

6. **Access the application**:
   - Application: `http://your-server-ip:3000`
   - Database: `localhost:5432` (if port is exposed)

### Docker Compose Services

- **db**: PostgreSQL 15 database with persistent volume (`./pgdata`)
- **prisma-migrate**: Runs database migrations on startup (one-time)
- **app**: Next.js application (port 3000)
- **qbo-sync**: QuickBooks Online auto-sync service (background worker)

### Useful Commands

```bash
# View logs
docker compose logs -f app
docker compose logs -f db
docker compose logs -f qbo-sync  # If auto-sync is enabled

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes database)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Access database
docker compose exec db psql -U wms -d wms

# Run Prisma Studio (for database management)
docker compose exec app npx prisma studio

# View container resource usage
docker stats

# Check QBO auto-sync service status
docker compose ps qbo-sync
docker compose logs -f qbo-sync
```

### Production Considerations

1. **Reverse Proxy**: Use Nginx or Traefik in front of the app:
   ```nginx
   # Nginx example
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

2. **SSL/TLS**: Use Let's Encrypt with Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

3. **Firewall**: Configure UFW:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

4. **Backups**: Set up regular database backups:
   ```bash
   # Add to crontab
   0 2 * * * docker compose exec -T postgres pg_dump -U wms wms > /backups/wms-$(date +\%Y\%m\%d).sql
   ```

5. **Monitoring**: Consider adding monitoring tools like:
   - Prometheus + Grafana
   - Health check endpoints
   - Log aggregation (ELK stack)

### Troubleshooting

**Migrations fail:**
```bash
# Check migration container logs
docker compose logs prisma-migrate

# Manually run migrations
docker compose exec app npx prisma migrate deploy
```

**Application won't start:**
```bash
# Check application logs
docker compose logs app

# Verify environment variables
docker compose exec app env | grep DATABASE_URL
```

**Database connection issues:**
```bash
# Test database connection
docker compose exec db psql -U wms -d wms -c "SELECT 1;"
```

**QBO auto-sync not working:**
```bash
# Check if service is running
docker compose ps qbo-sync

# View sync logs
docker compose logs -f qbo-sync

# Restart sync service
docker compose restart qbo-sync

# Verify QBO connection in admin dashboard
```

## License

Private - Internal Use Only