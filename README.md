# Warehouse Management System (WMS) for Fresh Produce

A modern, web-based Warehouse Management System specifically designed for fresh produce inventory tracking with lot-based management, FIFO (First In, First Out) support, and role-based access control.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: Shadcn UI
- **Icons**: Lucide React
- **Backend**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5

## Features

### Core Business Logic

- **Lot-Based Inventory**: All inventory is tracked by lots (e.g., "Apples - Lot #123 - Received 11/25")
- **FIFO Support**: Automatic sorting by oldest lots first for expiry management
- **Role-Based Access Control**:
  - **Admin**: Full access (CRUD Items, Users, Settings)
  - **Receiver**: Can only access "Inbound" screen to create new Lots
  - **Packer**: Can only access "Labeling" screen to print labels

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

## Next Steps

1. Create seed data for initial users and products
2. Build the authentication pages (login, signup)
3. Implement role-based route protection
4. Create the Inbound screen for Receivers
5. Create the Labeling screen for Packers
6. Build the Admin dashboard
7. Implement lot creation and management
8. Add FIFO sorting and expiry tracking

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
   DATABASE_URL=postgresql://wms:your_secure_password_here@postgres:5432/wms?schema=public
   NEXTAUTH_SECRET=your_secret_key_here_generate_with_openssl_rand_base64_32
   NEXTAUTH_URL=https://your-domain.com
   NODE_ENV=production
   APP_PORT=3000
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

6. **Access the application**:
   - Application: `http://your-server-ip:3000`
   - Database: `localhost:5432` (if port is exposed)

### Docker Compose Services

- **postgres**: PostgreSQL 15 database with persistent volume
- **prisma-migrate**: Runs database migrations on startup (one-time)
- **app**: Next.js application (port 3000)

### Useful Commands

```bash
# View logs
docker compose logs -f app
docker compose logs -f postgres

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes database)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Access database
docker compose exec postgres psql -U wms -d wms

# Run Prisma Studio (for database management)
docker compose exec app npx prisma studio

# View container resource usage
docker stats
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
docker compose exec postgres psql -U wms -d wms -c "SELECT 1;"
```

## License

Private - Internal Use Only