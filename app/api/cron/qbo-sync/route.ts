import { NextRequest, NextResponse } from "next/server"
import { importQboInvoicesSystem } from "@/app/actions/qbo-sync"

/**
 * Cron endpoint for automated QBO invoice syncing
 * Secured with CRON_SECRET token
 * 
 * Usage:
 *   curl -X POST https://your-domain.com/api/cron/qbo-sync \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  try {
    // Check for CRON_SECRET token
    const authHeader = request.headers.get("authorization")
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error("[Cron QBO Sync] CRON_SECRET not configured in environment")
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 500 }
      )
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader?.replace(/^Bearer\s+/i, "")

    if (!token || token !== expectedSecret) {
      console.warn("[Cron QBO Sync] Unauthorized access attempt")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Execute the sync (using system function that doesn't require auth)
    console.log("[Cron QBO Sync] Starting automated invoice sync...")
    const result = await importQboInvoicesSystem()

    if (result.success) {
      console.log(
        `[Cron QBO Sync] Completed: ${result.imported} imported, ${result.skipped || 0} skipped, ${result.total || 0} total`
      )
      return NextResponse.json({
        success: true,
        imported: result.imported,
        total: result.total || 0,
        skipped: result.skipped || 0,
        message: result.message,
      })
    } else {
      console.error(`[Cron QBO Sync] Failed: ${result.error}`)
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[Cron QBO Sync] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Also support GET for easier testing
export async function GET(request: NextRequest) {
  return POST(request)
}

