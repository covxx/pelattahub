import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse a date from various formats (Date object, ISO string, date-only string)
 * Ensures consistent timezone handling for dates from the database
 */
export function parseDate(date: Date | string | null | undefined): Date {
  if (!date) {
    return new Date()
  }
  
  if (date instanceof Date) {
    return date
  }
  
  if (typeof date === 'string') {
    // If it's a date-only string (YYYY-MM-DD), append time to ensure UTC
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(date + 'T00:00:00.000Z')
    }
    // If it's an ISO string without timezone, assume UTC
    if (date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
      return new Date(date + 'Z')
    }
    // Otherwise, parse normally (handles ISO strings with timezone)
    return new Date(date)
  }
  
  return new Date(date)
}
