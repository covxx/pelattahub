# 🚀 Quick Start Commands

## Step 1: Set Up Database Connection

Create or update `.env` file:

```bash
cat > .env << 'EOF'
# Database (Update with your credentials)
DATABASE_URL="postgresql://user:password@localhost:5432/wms?schema=public"

# Company Info (for labels)
NEXT_PUBLIC_COMPANY_NAME="Fresh Produce Co."
NEXT_PUBLIC_COMPANY_ADDRESS="123 Farm Road, CA 90210"

# NextAuth
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"
EOF
```

## Step 2: Run Database Migrations & Seed

```bash
# Generate Prisma client
npx prisma generate

# Run all migrations (including the new GTIN unique constraint)
npx prisma migrate dev

# Seed database with Admin user + 2 sample products
npm run db:seed
```

Expected output:
```
✅ Created admin user: admin@freshproduce.com
✅ Created product: Gala Apples (GTIN: 10012345678902)
✅ Created product: Cavendish Bananas (GTIN: 10012345678919)
🎉 Seed completed successfully!
```

## Step 3: Start Development Server

```bash
npm run dev
```

## Step 4: Login & Test

1. Open: http://localhost:3000
2. Login with:
   - **Email**: `admin@freshproduce.com`
   - **Password**: `admin123`

3. Test these pages:
   - `/dashboard/products` - View/Add products with GTIN
   - `/dashboard/receiving` - Receive inventory & print labels
   - `/dashboard/inventory` - View lots with traffic light expiry indicators

## 🖨️ Printer Setup (Optional)

To use the Web Serial API for direct printer connection:

1. **Use Chrome or Edge** (Firefox/Safari don't support Web Serial API)
2. **Connect Zebra Printer** via USB
3. Click "Connect to Zebra Printer" button
4. Select your printer from the browser's device picker

Note: For production, you'll need HTTPS. For local testing, HTTP on localhost works fine.

## 📝 Sample Workflow

### Adding a Product
1. Go to `/dashboard/products`
2. Click "Add Product"
3. Fill in:
   - SKU: `STR-ORG-24`
   - Name: `Organic Strawberries`
   - GTIN: `012345678` (will auto-pad to `00012345678901`)
4. Save

### Receiving Inventory
1. Go to `/dashboard/receiving`
2. Connect printer (if available)
3. Select product: "Gala Apples"
4. Enter quantity: `100`
5. Enter origin: `USA`
6. Click "Receive & Print"
7. Label automatically sent to printer
8. Form resets, product stays selected for next lot

### Viewing Inventory
1. Go to `/dashboard/inventory`
2. See products grouped
3. Click to expand and view lots
4. Check "Days Left" column
5. Notice:
   - 🟡 Yellow = 3 days or less
   - 🔴 Red = Expired
6. Use dropdown menu to:
   - Reprint label
   - Adjust quantity
   - View history

## 🔍 Database Inspection

To view data directly in Prisma Studio:

```bash
npx prisma studio
```

Opens at: http://localhost:5555

## 🧹 Reset Database (if needed)

```bash
# Delete all data
npx prisma migrate reset

# Re-seed
npm run db:seed
```

## 📊 What's in the Seed Data?

### Users
- **Admin User**
  - Email: `admin@freshproduce.com`
  - Password: `admin123`
  - Role: ADMIN

### Products
1. **Gala Apples**
   - SKU: `APP-GAL-40`
   - GTIN: `10012345678902`
   - Variety: Royal Gala
   - Target Temp: 32°F

2. **Cavendish Bananas**
   - SKU: `BAN-CAV-40`
   - GTIN: `10012345678919`
   - Variety: Cavendish
   - Target Temp: 56°F

## 🎯 Key Features to Test

### ✅ GTIN Validation
- Try entering 12 digits → Auto-pads to 14
- Try entering non-digits → Automatically filtered
- Try leaving blank → Shows error on receiving

### ✅ Lot Number Safety
- Automatically generates safe lot numbers
- Format: `{SKU}-{YYYYMMDD}-{HHMMSS}`
- Example: `APP-GAL-40-20241126-153045`
- No special characters that break ZPL

### ✅ Barcode Preview
- Shows GS1-128 Application Identifiers:
  - (01) = GTIN
  - (17) = Expiry Date
  - (10) = Lot Number

### ✅ Traffic Light System
- Red background when expired
- Yellow background when 3 days or less
- Normal when more than 3 days

### ✅ Direct Printer Connection
- No PDF intermediary
- Raw ZPL sent directly to Zebra printer
- Works with Web Serial API

---

**You're ready to go! Happy receiving! 📦🏷️**

