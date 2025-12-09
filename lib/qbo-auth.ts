/**
 * QuickBooks Online Authentication Engine (Manual OAuth Implementation)
 * 
 * Handles OAuth 2.0 authentication, token management, and auto-refresh logic.
 * Uses standard HTTP requests instead of intuit-oauth library to avoid logging issues.
 * Provides a headless client that automatically refreshes expired tokens.
 */

import { prisma } from "@/lib/prisma"

// QBO OAuth Configuration
const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET
// Normalize redirect URI - remove trailing slashes and ensure consistency
const normalizeRedirectUri = (uri: string): string => {
  return uri.trim().replace(/\/+$/, '') // Remove trailing slashes
}

const QBO_REDIRECT_URI = normalizeRedirectUri(
  process.env.QBO_REDIRECT_URI || 
  `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/qbo/callback`
)
const QBO_ENVIRONMENT = (process.env.QBO_ENVIRONMENT || "sandbox") as "sandbox" | "production"

// QBO OAuth endpoints
const QBO_AUTH_BASE = QBO_ENVIRONMENT === "production" 
  ? "https://appcenter.intuit.com/connect/oauth2"
  : "https://appcenter.intuit.com/connect/oauth2"

const QBO_TOKEN_BASE = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

const QBO_API_BASE = QBO_ENVIRONMENT === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com"

if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET) {
  console.warn("⚠️  QBO_CLIENT_ID and QBO_CLIENT_SECRET must be set in environment variables")
}

/**
 * Simple OAuth client interface for making API calls
 */
export interface QboOAuthClient {
  makeApiCall(options: {
    url: string
    method?: "GET" | "POST" | "PUT" | "DELETE"
    body?: any
  }): Promise<{
    statusCode: number
    text: string
    json(): any
  }>
  getRealmId(): string | null
}

/**
 * Get authorization URL for OAuth flow
 * A per-session state value is required for CSRF protection.
 */
export function getQboAuthUrl(state: string): string {
  if (!state) {
    throw new Error("OAuth state is required to generate the QBO auth URL")
  }
  if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET) {
    throw new Error("QBO credentials not configured. Please set QBO_CLIENT_ID and QBO_CLIENT_SECRET in .env")
  }

  // Scopes required for QBO API access
  const scopes = [
    "com.intuit.quickbooks.accounting",
    "openid",
    "profile",
    "email",
  ]

  const params = new URLSearchParams({
    client_id: QBO_CLIENT_ID,
    scope: scopes.join(" "),
    redirect_uri: QBO_REDIRECT_URI,
    response_type: "code",
    state,
    access_type: "offline", // Request refresh token
  })

  const authUrl = `${QBO_AUTH_BASE}?${params.toString()}`

  console.log("🔍 [QBO Auth] Generating authorization URL:", {
    redirectUri: QBO_REDIRECT_URI,
    redirectUriLength: QBO_REDIRECT_URI.length,
    environment: QBO_ENVIRONMENT,
    scopes,
    statePreview: state.substring(0, 8) + "...",
    clientIdPrefix: QBO_CLIENT_ID?.substring(0, 15) + "...",
  })

  return authUrl
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(authCode: string, realmId: string): Promise<void> {
  if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET) {
    throw new Error("QBO credentials not configured")
  }

  console.log("🔍 QBO Token Exchange - Configuration Check:", {
    hasAuthCode: !!authCode,
    realmId,
    redirectUri: QBO_REDIRECT_URI,
    redirectUriLength: QBO_REDIRECT_URI.length,
    environment: QBO_ENVIRONMENT,
    clientId: QBO_CLIENT_ID?.substring(0, 15) + "...",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    QBO_REDIRECT_URI: process.env.QBO_REDIRECT_URI,
  })

  try {
    // Exchange code for tokens using standard OAuth 2.0 flow
    const tokenUrl = QBO_TOKEN_BASE
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode.trim(),
      redirect_uri: QBO_REDIRECT_URI,
    })

    // Basic Auth header (client_id:client_secret base64 encoded)
    const credentials = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString("base64")

    console.log("About to exchange token with:", {
      codeLength: authCode?.length,
      codePreview: authCode?.substring(0, 20) + "...",
      redirectUri: QBO_REDIRECT_URI,
      environment: QBO_ENVIRONMENT,
      clientId: QBO_CLIENT_ID?.substring(0, 10) + "...",
      realmId,
      tokenUrl,
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      let errorJson: any = {}
      try {
        errorJson = JSON.parse(errorText)
      } catch (e) {
        // Not JSON
      }

      console.error("❌ Token exchange failed:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText,
        errorJson,
      })

      throw new Error(
        `Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}. ` +
        `Error: ${errorJson.error || errorText}. ` +
        `Description: ${errorJson.error_description || 'No additional details'}`
      )
    }

    const token = await tokenResponse.json()

    console.log("✅ Token exchange succeeded!", {
      hasAccessToken: !!token.access_token,
      hasRefreshToken: !!token.refresh_token,
      expiresIn: token.expires_in,
      refreshTokenExpiresIn: token.x_refresh_token_expires_in,
    })

    if (!token.access_token || !token.refresh_token) {
      throw new Error("Failed to obtain tokens from QuickBooks")
    }

    // Calculate expiration times
    const now = new Date()
    const tokenExpiresAt = token.expires_in 
      ? new Date(now.getTime() + token.expires_in * 1000)
      : null
    const refreshTokenExpiresAt = token.x_refresh_token_expires_in
      ? new Date(now.getTime() + token.x_refresh_token_expires_in * 1000)
      : null

    console.log("Saving QBO tokens to database...", {
      realmId,
      tokenExpiresAt,
      refreshTokenExpiresAt,
    })

    // Upsert integration settings
    const result = await prisma.integrationSettings.upsert({
      where: { provider: "qbo" },
      create: {
        provider: "qbo",
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires_at: tokenExpiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        realm_id: realmId,
        is_connected: true,
        metadata: {
          companyName: realmId, // Will be updated with actual company name later
        },
      } as any,
      update: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires_at: tokenExpiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        realm_id: realmId,
        is_connected: true,
        updatedAt: new Date(),
      } as any,
    })

    console.log("QBO tokens saved successfully:", {
      id: result.id,
      provider: result.provider,
      is_connected: (result as any).is_connected,
      realm_id: result.realm_id,
    })
  } catch (error: any) {
    console.error("Error in exchangeCodeForTokens:", {
      message: error?.message,
      error: error?.error,
      errorDescription: error?.error_description,
      redirectUri: QBO_REDIRECT_URI,
      environment: QBO_ENVIRONMENT,
    })
    
    throw error
  }
}

/**
 * Refresh access token if expired
 * CRITICAL: Refresh tokens rotate, so we must save the new refresh_token
 */
async function refreshAccessTokenIfNeeded(): Promise<void> {
  const settings = await prisma.integrationSettings.findUnique({
    where: { provider: "qbo" },
  })

  if (!settings || !settings.refresh_token) {
    throw new Error("QBO not connected. Please connect first.")
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date()
  const bufferTime = 5 * 60 * 1000 // 5 minutes
  const tokenExpiresAt = (settings as any).token_expires_at
  const isExpired = tokenExpiresAt 
    ? new Date(tokenExpiresAt.getTime() - bufferTime) <= now
    : true

  if (!isExpired) {
    return // Token is still valid
  }

  // Token is expired, refresh it
  if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET) {
    throw new Error("QBO credentials not configured")
  }

  const tokenUrl = QBO_TOKEN_BASE
  const tokenParams = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: settings.refresh_token,
  })

  // Basic Auth header
  const credentials = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString("base64")

  const refreshResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
    body: tokenParams.toString(),
  })

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text()
    throw new Error(`Token refresh failed: ${refreshResponse.status} ${refreshResponse.statusText}. ${errorText}`)
  }

  const newToken = await refreshResponse.json()

  if (!newToken.access_token || !newToken.refresh_token) {
    throw new Error("Failed to refresh QBO token")
  }

  // Calculate new expiration times
  const newTokenExpiresAt = newToken.expires_in
    ? new Date(now.getTime() + newToken.expires_in * 1000)
    : null
  const newRefreshTokenExpiresAt = newToken.x_refresh_token_expires_in
    ? new Date(now.getTime() + newToken.x_refresh_token_expires_in * 1000)
    : null

  // IMPORTANT: Save the new refresh_token (it rotates!)
  await prisma.integrationSettings.update({
    where: { provider: "qbo" },
    data: {
      access_token: newToken.access_token,
      refresh_token: newToken.refresh_token, // New refresh token
      token_expires_at: newTokenExpiresAt,
      refresh_token_expires_at: newRefreshTokenExpiresAt,
      updatedAt: new Date(),
    } as any,
  })

  console.log("✅ QBO token refreshed successfully")
}

/**
 * Get authenticated QBO client ready for API calls
 * Automatically refreshes token if expired
 */
export async function getQboClient(): Promise<QboOAuthClient> {
  const settings = await prisma.integrationSettings.findUnique({
    where: { provider: "qbo" },
  })

  if (!settings || !(settings as any).is_connected || !settings.access_token) {
    throw new Error("QBO not connected. Please connect first.")
  }

  // Refresh token if needed
  await refreshAccessTokenIfNeeded()

  // Get fresh settings after potential refresh
  const freshSettings = await prisma.integrationSettings.findUnique({
    where: { provider: "qbo" },
  })

  if (!freshSettings || !freshSettings.access_token || !freshSettings.realm_id) {
    throw new Error("Failed to obtain valid QBO token")
  }

  const realmId = freshSettings.realm_id

  // Return a simple client interface
  return {
    async makeApiCall(options: {
      url: string
      method?: "GET" | "POST" | "PUT" | "DELETE"
      body?: any
    }): Promise<{
      statusCode: number
      text: string
      json(): any
    }> {
      // Ensure URL is absolute
      let apiUrl = options.url
      if (!apiUrl.startsWith("http")) {
        // If relative, prepend QBO API base
        apiUrl = `${QBO_API_BASE}${apiUrl.startsWith("/") ? "" : "/"}${apiUrl}`
      }

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Authorization": `Bearer ${freshSettings.access_token}`,
        "Content-Type": "application/json",
      }

      const fetchOptions: RequestInit = {
        method: options.method || "GET",
        headers,
      }

      if (options.body && (options.method === "POST" || options.method === "PUT")) {
        fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body)
      }

      const response = await fetch(apiUrl, fetchOptions)
      const text = await response.text()

      return {
        statusCode: response.status,
        text,
        json(): any {
          try {
            return JSON.parse(text)
          } catch (e) {
            throw new Error(`Failed to parse JSON response: ${text.substring(0, 100)}`)
          }
        },
      }
    },
    getRealmId(): string | null {
      return realmId
    },
  }
}

/**
 * Get QBO connection status
 */
export async function getQboConnectionStatus(): Promise<{
  connected: boolean
  realmId?: string
  expiresAt?: Date
  companyName?: string
}> {
  const settings = await prisma.integrationSettings.findUnique({
    where: { provider: "qbo" },
  })

  if (!settings || !(settings as any).is_connected) {
    return { connected: false }
  }

  return {
    connected: true,
    realmId: settings.realm_id || undefined,
    expiresAt: (settings as any).token_expires_at || undefined,
    companyName: settings.metadata && typeof settings.metadata === "object" && "companyName" in settings.metadata
      ? String(settings.metadata.companyName)
      : undefined,
  }
}

/**
 * Disconnect QBO (clear tokens)
 */
export async function disconnectQbo(): Promise<void> {
  await prisma.integrationSettings.update({
    where: { provider: "qbo" },
    data: {
      is_connected: false,
      access_token: "",
      refresh_token: null,
      token_expires_at: null,
      refresh_token_expires_at: null,
      realm_id: null,
    } as any,
  })
}
