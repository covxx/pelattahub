import { NextRequest, NextResponse } from "next/server"
import { getQboAuthUrl } from "@/lib/qbo-auth"
import { auth } from "@/lib/auth"
import crypto from "crypto"

/**
 * OAuth Initiation Route
 * Redirects to QuickBooks OAuth authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const role = session?.user?.role
    const isAuthorized = role === "ADMIN" || role === "MANAGER"

    if (!session?.user) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("callbackUrl", "/dashboard/admin/integrations/qbo")
      return NextResponse.redirect(loginUrl)
    }

    if (!isAuthorized) {
      return NextResponse.redirect(new URL("/forbidden", request.url))
    }

    const state = crypto.randomBytes(32).toString("hex")
    const authUrl = getQboAuthUrl(state)

    const response = NextResponse.redirect(authUrl)
    response.cookies.set("qbo_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/qbo",
      maxAge: 10 * 60, // 10 minutes
    })
    return response
  } catch (error) {
    console.error("Error generating QBO auth URL:", error)
    return NextResponse.redirect(
      new URL(
        `/dashboard/admin/integrations/qbo?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Failed to initiate OAuth flow"
        )}`,
        request.url
      )
    )
  }
}
