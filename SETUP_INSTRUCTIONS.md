# WMS Setup Instructions

## ✅ What's Been Implemented

### 1. Database Schema Updates
- **GTIN Field**: Made unique in the `Product` model (required for GS1-128 barcodes)
- **Lot Structure**: Ensured `InventoryLot` has `lot_number` and `expiry_date` fields

### 2. Seed Data
- Created `prisma/seed.ts` with:
  - 1 Admin user (email: `admin@freshproduce.com`, password: `admin123`)
  - 2 Sample products with GTINs:
    - Gala Apples (GTIN: `10012345678902`)
    - Cavendish Bananas (GTIN: `10012345678919`)

### 3. Product Management
- Updated Add/Edit Product dialogs with:
  - **14-digit GTIN validation**
  - **Auto-padding**: If you enter 12 digits, it pads to 14
  - **Required field**: GTIN is now required for receiving inventory

### 4. ZPL Label Generation
- Created `generateGS1Label()` function in `lib/zpl-generator.ts`
- Generates GS1-128 barcodes with:
  - Company name and address (configurable via env vars)
  - Product name
  - Expiry date (calculated as received date + 10 days)
  - GTIN (14 digits, padded)
  - Lot number (alphanumeric only)
- Label size: 4x2 inches at 203 DPI (812x406 dots)

### 5. Receiving Page (`/dashboard/receiving`)
- **Product Select**: Combobox showing all products with GTIN status indicator
- **GTIN Validation**: Blocks receiving if product doesn't have GTIN
- **Lot Number Safety**: Auto-generates lot numbers using only alphanumeric + hyphens
- **Barcode Preview**: Shows GS1-128 data that will be encoded:
  - (01) GTIN
  - (17) Expiry Date (YYMMDD)
  - (10) Lot Number
- **Printer Integration**: 
  - Must connect to Zebra printer via Web Serial API
  - Shows warning banner if not connected
  - Automatically prints label after lot creation
- **Form Reset**: Keeps product selected for fast batch receiving

### 6. Inventory Dashboard (`/dashboard/inventory`)
- **Traffic Light System**:
  - 🔴 **Expired** (Days < 0): Red background, bold text
  - 🟡 **Warning** (Days ≤ 3): Yellow background, bold text
  - ✅ **Good**: Default styling
- **Days Left Column**: Shows computed days until expiry
- **Reprint Label**: Uses Web Serial API to send ZPL directly to printer
- **Actions Dropdown**:
  - Reprint Label (disabled if printer not connected)
  - Adjust Qty
  - View History

## 🚀 Next Steps: Running the Migration

### Step 1: Set Up Environment Variables

Make sure your `.env` file has the database connection:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/wms?schema=public"

# Company Info (for labels)
NEXT_PUBLIC_COMPANY_NAME="Fresh Produce Co."
NEXT_PUBLIC_COMPANY_ADDRESS="123 Farm Road, CA 90210"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

### Step 2: Run the Migration

```bash
# Navigate to project directory
cd /Users/cj/wms

# Run the migration to make GTIN unique
npx prisma migrate dev --name make_gtin_unique

# Seed the database with sample data
npm run db:seed
```

### Step 3: Start the Development Server

```bash
npm run dev
```

### Step 4: Test the Application

1. **Login**: Go to `http://localhost:3000` and login with:
   - Email: `admin@freshproduce.com`
   - Password: `admin123`

2. **Test Product Management** (`/dashboard/products`):
   - Click "Add Product"
   - Try entering a 12-digit GTIN (e.g., `012345678901`)
   - It should auto-pad to 14 digits
   - Save and verify it appears in the list

3. **Test Receiving** (`/dashboard/receiving`):
   - First, click "Connect Printer" (only works in Chrome/Edge over HTTPS in production)
   - Select a product from the dropdown
   - Notice the GTIN indicator (✓ or ⚠)
   - Enter quantity, date, and origin
   - See the barcode preview showing (01), (17), (10) data
   - Click "Receive & Print"
   - Label is sent to printer automatically

4. **Test Inventory Dashboard** (`/dashboard/inventory`):
   - View lots grouped by product
   - Expand a product to see individual lots
   - Check the "Days Left" column
   - Look for yellow/red highlighting based on expiry
   - Use the actions dropdown to "Reprint Label"

## 📝 Key Files Created/Modified

### New Files
- `prisma/seed.ts` - Database seeding script
- `app/dashboard/receiving/page.tsx` - Receiving page
- `components/receiving/ReceivingForm.tsx` - Receiving form with validation
- `SETUP_INSTRUCTIONS.md` - This file!

### Modified Files
- `prisma/schema.prisma` - Made GTIN unique
- `package.json` - Added seed script
- `lib/zpl-generator.ts` - Added `generateGS1Label()` function
- `components/products/AddProductDialog.tsx` - GTIN validation
- `components/products/EditProductDialog.tsx` - GTIN validation
- `components/inventory/InventoryView.tsx` - Days Left calculation
- `components/inventory/LotRow.tsx` - Traffic light styling, reprint
- `app/actions/inventory.ts` - Added `createLot()` and `getLotById()`
- `README.md` - Updated with seed instructions

## 🔧 Troubleshooting

### Database Connection Issues
If you get "Error validating datasource", make sure:
1. PostgreSQL is running
2. Database exists
3. Credentials in `.env` are correct

### Web Serial API Issues
The Web Serial API requires:
- **Browser**: Chrome or Edge (not Firefox/Safari)
- **Context**: HTTPS (or localhost for testing)
- **Permissions**: User must grant access to USB device

For local testing, the API works over HTTP on localhost.

### GTIN Already Exists Error
If you're updating existing products, you may need to:
1. Check for duplicate GTINs in your database
2. Update or remove duplicates before running migration
3. Or make GTIN nullable temporarily during migration

## 📊 GS1-128 Barcode Format

The generated barcode follows this structure:

```
>;>801{14-digit GTIN}17{YYMMDD expiry}>610{Lot Number}
```

Example breakdown:
- `>;` - Start Code C (high density)
- `>8` - FNC1 (GS1 indicator)
- `01` - GTIN Application Identifier
- `10012345678902` - 14-digit GTIN
- `17` - Expiry Date Application Identifier
- `251210` - December 10, 2025
- `>6` - Switch to Subset B (alphanumeric)
- `10` - Lot Number Application Identifier
- `APP-GAL-40-20241126-103045` - Lot number

## 🎯 Next Features (Future)

Consider implementing:
1. **Audit Log System** - Track all changes to lots
2. **Barcode Scanner Integration** - Scan products during receiving
3. **Temperature Monitoring** - Alert if storage temp exceeds target
4. **Low Stock Alerts** - Notify when inventory is low
5. **Reporting Dashboard** - Charts for inventory trends
6. **Multi-warehouse Support** - Track inventory across locations

## 📞 Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the terminal for server errors
3. Verify all environment variables are set
4. Ensure database is accessible
5. Try `npx prisma studio` to inspect data directly

---

**Ready to receive inventory!** 🚀📦

