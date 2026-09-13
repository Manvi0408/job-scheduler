/**
 * Central API configuration for the web dashboard.
 *
 * In production the browser runs this code on the visitor's machine, so the API
 * URL can NEVER be "localhost" — that would point at the visitor's own computer.
 * Set NEXT_PUBLIC_API_URL to the deployed backend origin (e.g.
 * https://scheduler-api.onrender.com) in your hosting provider's environment
 * variables. It must be present at BUILD time, because Next.js inlines
 * NEXT_PUBLIC_* values into the client bundle during `next build`.
 *
 * Falls back to http://localhost:3000 for local development.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3000';

/** Base URL for REST calls, including the global prefix and version. */
export const API_V1 = `${API_BASE}/api/v1`;
