/**
 * Version Information Utility
 * 
 * Provides version number and commit ID for display in the application
 */

export const APP_VERSION = "1.1"
export const APP_VERSION_NAME = "Orion"

/**
 * Get the current git commit ID
 * Uses environment variable (set during build/deploy) or falls back to 'dev'
 */
export function getCommitId(): string {
  // Try environment variable first (set during build/deploy)
  // NEXT_PUBLIC_ prefix makes it available on client-side
  if (typeof window !== 'undefined') {
    // Client-side: use public env var
    const commitId = process.env.NEXT_PUBLIC_COMMIT_ID
    if (commitId) {
      return commitId.substring(0, 7) // Short commit hash
    }
  } else {
    // Server-side: can use private env var or try git
    const commitId = process.env.NEXT_PUBLIC_COMMIT_ID || process.env.COMMIT_ID
    if (commitId) {
      return commitId.substring(0, 7)
    }
    
    // Try to read from git (server-side only)
    try {
      const { execSync } = require('child_process')
      const commitId = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
      return commitId
    } catch {
      // Git not available or not in a git repo
      return 'dev'
    }
  }
  
  return 'dev'
}

/**
 * Get full version string with commit ID
 */
export function getVersionString(): string {
  const commitId = getCommitId()
  return `v${APP_VERSION} (${commitId})`
}

/**
 * Get version info object
 * Works on both client and server
 */
export function getVersionInfo() {
  return {
    version: APP_VERSION,
    name: APP_VERSION_NAME,
    commitId: getCommitId(),
    versionString: getVersionString(),
  }
}
