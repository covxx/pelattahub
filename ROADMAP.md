# WMS Project Roadmap

This document outlines planned features and improvements for the Warehouse Management System.

## 🎯 Current Status

The system currently supports:
- ✅ Lot-based inventory tracking
- ✅ Receiving events with batch processing
- ✅ PTI-compliant label generation
- ✅ Admin workspace with master data management
- ✅ Receiving history and audit logging
- ✅ Role-based access control
- ✅ System settings and configuration

## 📋 Upcoming Features

### 🏷️ Print UX Polish

**Priority:** High  
**Status:** Planned

**Goal:** Improve the print experience to be seamless and user-friendly.

**Tasks:**
- Fix `printZplViaBrowser` to use a hidden iframe or auto-closing window
- Implement one-click printing: Click → System Dialog → Done
- Eliminate lingering popups and manual window management
- Add print queue management for batch operations

**Expected Outcome:**
- Streamlined printing workflow
- No user intervention required after clicking print
- Better user experience for warehouse staff

---

### 🚚 Outbound Order Management

**Priority:** High  
**Status:** Planned

**Goal:** Complete order-to-shipment workflow with intelligent lot allocation.

#### Order Entry
- Admin interface to create Sales Orders
- Customer selection and order item entry
- Order status tracking (Draft, Confirmed, Allocated, Picked, Shipped)

#### Allocation Logic
- **FIFO (First-In-First-Out) Algorithm:**
  - Automatically suggest specific Lots based on expiry dates
  - Prioritize oldest lots first to minimize waste
  - Consider lot status (AVAILABLE, QC_PENDING, etc.)
  - Handle partial lot allocation
  - Visual allocation preview before confirmation

#### Fulfillment
- Warehouse view to "Pick" items from allocated lots
- Barcode scanning for lot validation during picking
- Pick confirmation and quantity verification
- Integration with label printing for shipping labels
- Pick list generation and tracking

**Expected Outcome:**
- Complete order-to-shipment workflow
- Reduced waste through intelligent lot allocation
- Accurate picking with barcode validation
- Full traceability from order to shipment

---

### 📄 Document Generation (PDFs)

**Priority:** Medium  
**Status:** Planned

**Goal:** Generate professional, downloadable PDF documents for key business processes.

#### Receiving Documents
- **Receiving Receipt PDF:**
  - Professional format for vendor records
  - Include all lot details, quantities, and timestamps
  - Company branding and contact information
  - Downloadable and printable

#### Shipping Documents
- **Bill of Lading (BOL):**
  - Standard BOL format
  - Customer and shipping information
  - Itemized list of shipped products and lots
  - Carrier information and tracking numbers

- **Packing Slips:**
  - Customer-facing packing list
  - Item descriptions and quantities
  - Lot numbers for traceability
  - Order number and shipping date

**Technical Implementation:**
- Use `react-pdf` or `@react-pdf/renderer` for high-fidelity PDF generation
- Server-side PDF generation for better performance
- Template-based design for consistency
- Downloadable files with proper naming conventions

**Expected Outcome:**
- Professional documentation for all transactions
- Improved record-keeping and compliance
- Better customer experience with clear documentation

---

### 💰 QuickBooks Online (QBO) Integration

**Priority:** Medium  
**Status:** Planned

**Goal:** Two-way synchronization with QuickBooks Online for seamless accounting integration.

#### Two-Way Sync Architecture

**Customers:**
- **QBO → WMS:** Read-only customer data sync
  - Automatic import of customer records from QuickBooks
  - Customer name, address, contact information
  - Sync frequency: Real-time or scheduled (configurable)
  - Conflict resolution: QBO is source of truth

**Items/Products:**
- **QBO → WMS:** Master data source synchronization
  - Product/SKU information from QuickBooks
  - Pricing, descriptions, and categorization
  - Automatic updates when QBO data changes
  - WMS extends QBO data with warehouse-specific fields (GTIN, lot tracking, etc.)

**Invoices:**
- **QBO → WMS:** Invoice data synchronization
  - Import invoice information for order fulfillment
  - Link WMS sales orders to QBO invoices
  - Track invoice status and payment information
  - Support for credit memos and adjustments

**WMS → QBO:** (Future Phase)
- Export receiving events as bills/vendor credits
- Export shipments as sales receipts
- Inventory quantity synchronization

#### Technical Requirements
- QuickBooks Online API integration
- OAuth 2.0 authentication flow
- Webhook support for real-time updates
- Error handling and retry logic
- Sync status dashboard for administrators

**Expected Outcome:**
- Eliminate manual data entry between systems
- Real-time financial data visibility
- Accurate inventory and accounting alignment
- Reduced errors and improved efficiency

---

## 🔄 Future Considerations

### Additional Features (Not Yet Prioritized)

- **Advanced Reporting & Analytics:**
  - Inventory turnover reports
  - Expiry tracking and waste analysis
  - Vendor performance metrics
  - Customer order history

- **Mobile App:**
  - Native mobile app for warehouse operations
  - Barcode scanning with device camera
  - Offline capability for remote locations

- **Multi-Warehouse Support:**
  - Multiple warehouse locations
  - Inter-warehouse transfers
  - Location-based inventory tracking

- **Advanced Quality Control:**
  - QC checkpoints and workflows
  - Photo/document attachments
  - QC hold and release processes

- **API & Integrations:**
  - RESTful API for third-party integrations
  - Webhook support for external systems
  - EDI support for large customers

---

## 📝 Notes

- Features are prioritized based on business needs and user feedback
- Timeline estimates will be added as development progresses
- Breaking changes will be documented in release notes
- See `KNOWN_ISSUES.md` for current system limitations

---

*Last Updated: November 30, 2025*

