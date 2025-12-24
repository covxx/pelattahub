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
  // NEXT_PUBLIC_ prefix makes it available on both client and server
  const commitId = process.env.NEXT_PUBLIC_COMMIT_ID || process.env.COMMIT_ID
  
  if (commitId && commitId.trim()) {
    return commitId.trim().substring(0, 7) // Short commit hash
  }
  
  // Server-side: try to read from git as fallback
  if (typeof window === 'undefined') {
    try {
      const { execSync } = require('child_process')
      const gitCommitId = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
      if (gitCommitId) {
        return gitCommitId
      }
    } catch {
      // Git not available or not in a git repo
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

