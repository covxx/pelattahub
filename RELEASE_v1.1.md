# Release v1.1 "Orion" - QuickBooks Auto-Sync & Enhanced Invoice Processing

**Release Date:** December 18, 2025  
**Release Name:** Orion

## 🎉 Major Features

### QuickBooks Online Auto-Sync Service
We've introduced a powerful background synchronization service that automatically keeps your WMS in sync with QuickBooks Online.

- **Automated Background Sync**: Runs continuously in the background, syncing data every minute (configurable)
- **Configurable Sync Types**: Enable/disable syncing for customers, products, vendors, and invoices independently
- **Production-Ready**: Fully containerized Docker service with automatic restart and health monitoring
- **Flexible Scheduling**: Configure sync intervals (1, 5, 10, 15, 30, or 60 minutes)
- **Database-Driven Settings**: Auto-sync can be enabled/disabled via the admin dashboard without code changes

### Enhanced Invoice Sync Processing
Significant improvements to invoice synchronization reliability and observability.

- **Accurate Metrics**: Fixed double-counting issue where skipped invoices were incorrectly counted as errors
- **Detailed Skip Tracking**: New `skipped`, `invoiceIdsFound`, and `skippedDetails` fields provide comprehensive sync reporting
- **Consistent Skip Handling**: Missing customers, invalid items, and already-imported invoices are now properly tracked as "skipped" rather than errors
- **Comprehensive Logging**: Added detailed debug logging with `[QBO Invoice Sync]` prefix for easier troubleshooting
- **Unified Implementation**: Standalone and server action versions now have identical behavior and return structures

## 🐛 Bug Fixes

- **Auto-Sync Settings**: Fixed issue where saving auto-sync settings would fail if QBO wasn't connected yet. Now uses `upsert()` to gracefully create the settings record.
- **Invoice Metrics**: Resolved double-counting of skipped invoices in error metrics, providing accurate reporting
- **Standalone Sync**: Aligned standalone invoice sync implementation with server action version for consistency

## 🚀 Deployment Improvements

- **Production Override Support**: Deploy script now automatically detects and uses `docker-compose.prod.yml` for production-specific configurations
- **QBO Service Verification**: Added comprehensive post-deployment verification steps for the auto-sync service
- **Environment Documentation**: Updated `ENV_TEMPLATE_DOCKER.txt` with all QBO auto-sync configuration options

## 📋 Configuration

### QuickBooks Auto-Sync Environment Variables

```bash
# Enable/disable auto-sync service
QBO_AUTO_SYNC_ENABLED="true"

# Sync interval in minutes (1, 5, 10, 15, 30, or 60)
QBO_SYNC_INTERVAL_MINUTES="1"

# Enable/disable specific sync types
QBO_SYNC_CUSTOMERS="true"
QBO_SYNC_PRODUCTS="true"
QBO_SYNC_VENDORS="true"
QBO_SYNC_INVOICES="true"
```

## 🔧 Technical Details

### New Docker Service
- **Service Name**: `qbo-sync`
- **Container**: `wms-qbo-sync`
- **Restart Policy**: `unless-stopped`
- **Dependencies**: Requires `app` service to be running

### API Changes
- `importQboInvoices()` now returns:
  - `skipped`: Count of skipped invoices
  - `invoiceIdsFound`: Array of all invoice IDs found
  - `skippedDetails`: Array of skip reasons for each skipped invoice

### Database Changes
- `IntegrationSettings` metadata now supports auto-sync configuration
- Settings can be saved before QBO connection is established

## 📚 Documentation Updates

- Added QBO auto-sync verification steps to `POST_DEPLOYMENT.md`
- Updated `ENV_TEMPLATE_DOCKER.txt` with QBO configuration options
- Enhanced deployment script with production override detection

## 🔄 Migration Notes

No database migrations required. The auto-sync service will work with existing QBO connections.

To enable auto-sync:
1. Set `QBO_AUTO_SYNC_ENABLED=true` in your `.env` file
2. Deploy using `./deploy-remote.sh` (or restart services)
3. Verify service is running: `docker compose ps qbo-sync`
4. Check logs: `docker compose logs -f qbo-sync`

## 🎯 What's Next

See [ROADMAP.md](./ROADMAP.md) for upcoming features:

- 📱 **Mobile Version** - Native mobile experience for warehouse operations
- 🌙 **Dark Mode** - System-wide dark theme support
- 🛡️ **Food Safety Features** - Enhanced food safety compliance and tracking

---

**Full Changelog**: See commit history for detailed changes.
