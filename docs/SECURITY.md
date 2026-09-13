# Security Hardening

This document records a security review of the platform and the fixes applied.
Findings are ordered by severity.

## Critical

### 1. Authentication was completely bypassed
`AuthGuard` ignored the `Authorization` header entirely — it never verified the
JWT. Instead it loaded a hardcoded `admin@scheduler.io` account (falling back to
an all-zero UUID admin) and set `request.user` to it, then returned `true`. Every
"protected" endpoint was therefore reachable by anyone, always acting as admin.

**Fix:** `AuthGuard` now requires a `Bearer` token, verifies its signature and
expiry with `jsonwebtoken`, rejects missing/malformed/forged/expired tokens with
`401`, and loads the real user (confirming the account still exists).

### 2. Role-based access control was faked
`RolesGuard` hardcoded `userRole = 'OWNER'` and the all-zero organization id, then
returned `true` — so the `@Roles(...)` decorators enforced nothing and there was
no tenant isolation.

**Fix:** `RolesGuard` now resolves the organization that owns the target resource
(walking `job -> queue -> project -> organization` from the route params), verifies
the authenticated user is a member of that organization (**tenant isolation**), and
enforces the member's real role against the roles required by `@Roles(...)`.

### 3. Hardcoded credential backdoor in login
`login()` accepted the passwords `admin` / `admin123` / `bypassed` for
`admin@scheduler.io`, and `QueueService.onModuleInit` seeded that account
(`passwordHash: 'bypassed'`) on every boot.

**Fix:** removed the password bypass (login now always uses `bcrypt.compare`) and
removed the seeding of the privileged backdoor account.

### 4. Hardcoded JWT signing secret
The JWT secret fell back to a committed literal
(`'JWT_Super_Secret_Key_For_Job_Scheduler_2026_!'`) when `JWT_SECRET` was unset —
allowing anyone with the source to forge valid tokens.

**Fix:** a single `getJwtSecret()` helper. In production a missing/short
`JWT_SECRET` (< 16 chars) is fatal (fail fast); the insecure literal is only used
outside production and is clearly labelled.

## High

### 5. No rate limiting
Auth endpoints had no throttling, leaving them open to credential brute-forcing
and signup abuse.

**Fix:** added `@nestjs/throttler` — a global baseline of 100 req/min/IP, tightened
to 5 req/min/IP on `/auth/*`.

### 6. `synchronize: true` in production
TypeORM schema auto-sync ran unconditionally, including in production, where it can
silently drop or alter columns (data-loss risk).

**Fix:** `synchronize` is enabled outside production only, or via an explicit
`DB_SYNCHRONIZE=true` opt-in for a one-off first boot on a fresh database.

## Medium

### 7. Weak password policy
Minimum password length was 6.

**Fix:** raised to 8 characters.

## Operational notes

- **Rotate any credentials that were shared in plaintext** during setup/debugging.
- Existing data created while auth was bypassed is tied to the old all-zero admin
  and won't be visible to real accounts — sign up fresh after deploying these
  changes.

## Recommended next steps (not yet done)
- Refresh-token rotation / shorter access-token lifetime.
- Password complexity rules and breached-password checks.
- Audit logging for auth and privileged actions.
- Move `DATABASE_URL`/secrets to a managed secret store.
