import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/qbo-auth"
import { revalidatePath } from "next/cache"

/**
 * OAuth Callback Route
 * Handles the return from Intuit OAuth flow
 * 
 * Query params:
 * - code: Authorization code from Intuit
 * - realmId: QuickBooks company ID
 * - state: CSRF protection state
 */
export async function GET(request: NextRequest) {
  // Get base URL from environment or construct from request headers
  const baseUrl = process.env.NEXTAUTH_URL || 
    (request.headers.get("host") 
      ? `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`
      : "http://localhost:3000")

  const redirectWithCleanup = (url: string) => {
    const response = NextResponse.redirect(url)
    response.cookies.set("qbo_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/qbo",
      maxAge: 0,
    })
    return response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const authCode = searchParams.get("code")?.trim()
    const realmId = searchParams.get("realmId")?.trim()
    const state = searchParams.get("state")?.trim()
    const error = searchParams.get("error")
    const storedState = request.cookies.get("qbo_oauth_state")?.value

    // Extract the actual redirect URI from the callback URL
    const callbackUrl = new URL(request.url)
    const actualRedirectUri = `${callbackUrl.protocol}//${callbackUrl.host}${callbackUrl.pathname}`
    const expectedRedirectUri = process.env.QBO_REDIRECT_URI || `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/qbo/callback`
    
    console.log("QBO Callback received:", {
      hasCode: !!authCode,
      hasRealmId: !!realmId,
      state,
      error,
      fullUrl: request.url,
      actualRedirectUri,
      expectedRedirectUri,
      redirectUriMatch: actualRedirectUri === expectedRedirectUri,
      QBO_REDIRECT_URI: process.env.QBO_REDIRECT_URI,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    })

    // Handle OAuth errors
    if (error) {
      console.error("QBO OAuth error from Intuit:", error)
      revalidatePath("/dashboard/admin/integrations/qbo")
      return redirectWithCleanup(
        `${baseUrl}/dashboard/admin/integrations/qbo?error=${encodeURIComponent(error)}`
      )
    }

    // Validate required parameters
    if (!authCode || !realmId) {
      console.error("Missing required OAuth parameters:", { hasCode: !!authCode, hasRealmId: !!realmId })
      revalidatePath("/dashboard/admin/integrations/qbo")
      return redirectWithCleanup(
        `${baseUrl}/dashboard/admin/integrations/qbo?error=${encodeURIComponent("Missing authorization code or realm ID")}`
      )
    }

    // Validate state (CSRF protection)
    if (!state || !storedState || state !== storedState) {
      console.error("Invalid state parameter:", { received: state, expected: "stored cookie" })
      revalidatePath("/dashboard/admin/integrations/qbo")
      return redirectWithCleanup(
        `${baseUrl}/dashboard/admin/integrations/qbo?error=${encodeURIComponent("Invalid state parameter")}`
      )
    }

    // Exchange code for tokens
    try {
      console.log("Calling exchangeCodeForTokens...")
      await exchangeCodeForTokens(authCode, realmId)
      console.log("Token exchange successful!")
    } catch (error) {
      console.error("Failed to exchange code for tokens:", error)
      // Re-throw to be caught by outer catch block
      throw error
    }

    // Revalidate the page to show updated connection status
    revalidatePath("/dashboard/admin/integrations/qbo")

    // Redirect to success page
    return redirectWithCleanup(`${baseUrl}/dashboard/admin/integrations/qbo?success=true`)
  } catch (error: any) {
    console.error("Error in QBO OAuth callback:", {
      message: error?.message,
      originalMessage: error?.originalMessage,
      error: error?.error,
      errorDescription: error?.error_description,
      intuitTid: error?.intuit_tid,
      stack: error?.stack,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    })
    revalidatePath("/dashboard/admin/integrations/qbo")
    
    // Provide a more helpful error message
    let errorMessage = "Failed to connect to QuickBooks"
    if (error?.error === 'invalid_request') {
      errorMessage = `Invalid request. Please verify the redirect URI in QuickBooks Developer Portal matches: ${process.env.QBO_REDIRECT_URI || 'http://localhost:3000/api/auth/qbo/callback'}`
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return redirectWithCleanup(
      `${baseUrl}/dashboard/admin/integrations/qbo?error=${encodeURIComponent(errorMessage)}`
    )
  }
}

