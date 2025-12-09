#!/usr/bin/env tsx
/**
 * Diagnostic script to check QBO OAuth configuration
 * Run: npx tsx scripts/check-qbo-config.ts
 */

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET
const QBO_REDIRECT_URI = process.env.QBO_REDIRECT_URI || `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/qbo/callback`
const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || "sandbox"
const NEXTAUTH_URL = process.env.NEXTAUTH_URL

console.log("=".repeat(60))
console.log("QBO OAuth Configuration Diagnostic")
console.log("=".repeat(60))
console.log()

console.log("Environment Variables:")
console.log(`  QBO_CLIENT_ID: ${QBO_CLIENT_ID ? QBO_CLIENT_ID.substring(0, 15) + "..." : "❌ NOT SET"}`)
console.log(`  QBO_CLIENT_SECRET: ${QBO_CLIENT_SECRET ? "✅ SET (hidden)" : "❌ NOT SET"}`)
console.log(`  QBO_REDIRECT_URI: ${QBO_REDIRECT_URI}`)
console.log(`  QBO_ENVIRONMENT: ${QBO_ENVIRONMENT}`)
console.log(`  NEXTAUTH_URL: ${NEXTAUTH_URL || "❌ NOT SET"}`)
console.log()

console.log("Redirect URI Analysis:")
console.log(`  Full URI: ${QBO_REDIRECT_URI}`)
console.log(`  Length: ${QBO_REDIRECT_URI.length} characters`)
console.log(`  Has trailing slash: ${QBO_REDIRECT_URI.endsWith("/") ? "⚠️ YES" : "✅ NO"}`)
console.log(`  Protocol: ${QBO_REDIRECT_URI.startsWith("http://") ? "http" : QBO_REDIRECT_URI.startsWith("https://") ? "https" : "❌ UNKNOWN"}`)
console.log()

console.log("QuickBooks Developer Portal Checklist:")
console.log("  1. Go to: https://developer.intuit.com/app/developer/dashboard")
console.log("  2. Select your app")
console.log("  3. Go to 'Keys & OAuth' section")
console.log(`  4. Verify Redirect URI matches EXACTLY: ${QBO_REDIRECT_URI}`)
console.log("     - No trailing slash")
console.log("     - Exact case match")
console.log("     - Exact protocol (http vs https)")
console.log(`  5. Verify Environment: ${QBO_ENVIRONMENT}`)
console.log(`  6. Verify Client ID matches: ${QBO_CLIENT_ID?.substring(0, 15)}...`)
console.log()

console.log("Common Issues:")
console.log("  ❌ Redirect URI mismatch (most common)")
console.log("  ❌ Environment mismatch (sandbox vs production)")
console.log("  ❌ Client ID/Secret mismatch")
console.log("  ❌ Authorization code already used (single-use)")
console.log("  ❌ Authorization code expired (expires quickly)")
console.log()

console.log("=".repeat(60))

