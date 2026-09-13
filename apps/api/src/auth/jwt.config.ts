/**
 * Single source of truth for the JWT signing secret.
 *
 * Security: there is NO hardcoded production fallback. In production a missing or
 * weak JWT_SECRET is a fatal misconfiguration (anyone could forge tokens), so we
 * fail fast. A clearly-labelled insecure secret is only used outside production
 * to keep local dev frictionless.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is required in production and must be at least 16 characters.'
    );
  }
  return 'dev-only-insecure-jwt-secret-do-not-use-in-prod';
}

export const JWT_EXPIRES_IN = '24h';
