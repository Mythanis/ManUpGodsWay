import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date to user's local timezone
export function formatLocalDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  return dateObj.toLocaleDateString(undefined, defaultOptions);
}

// Format datetime to user's local timezone
export function formatLocalDateTime(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options
  };
  
  return dateObj.toLocaleString(undefined, defaultOptions);
}

// Format time to user's local timezone
export function formatLocalTime(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    ...options
  };
  
  return dateObj.toLocaleString(undefined, defaultOptions);
}

// Get current date in user's timezone for form inputs (YYYY-MM-DD format)
export function getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert date string for safe parsing (avoids timezone issues)
export function parseDateSafely(dateString: string): Date {
  // If it's already a full ISO string, use it directly
  if (dateString.includes('T')) {
    return new Date(dateString);
  }
  // If it's just a date string (YYYY-MM-DD), add noon time to avoid timezone issues
  return new Date(dateString + 'T12:00:00');
}
