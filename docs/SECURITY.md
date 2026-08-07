# Security Notes

## 1. Scope

This document describes controls implemented in the TripBuddy repository and the remaining work required before handling real sensitive user data at scale. It is not a certification or penetration-test report.

## 2. Implemented controls

### Passwords

- Passwords are hashed with bcrypt before storage.
- Registration, invitation account creation, reset, and password-change flows enforce a minimum length.
- The 72-byte bcrypt input limit is enforced to avoid silently ignored password bytes.
- Password responses never expose stored hashes.

The Identity database column is named `password` for historical reasons but contains the bcrypt hash, not plaintext.

### Email verification and password reset

- Verification and reset tokens are random, one-time, and time-limited.
- Only SHA-256 token hashes are stored in PostgreSQL.
- Successful consumption records `used_at`.
- Reset requests do not reveal whether an email exists.

### JWT authentication

- JWTs are signed using `IDENTITY_JWT_SECRET`.
- Identity and Trip services validate authenticated requests.
- Production startup rejects missing or placeholder JWT secrets.
- The Trip Service uses the same signing secret to authorize domain requests without querying Identity for every request.

### Authorization

- Trip access is checked server-side for every protected operation.
- Role permissions distinguish view, contribute, and manage operations.
- The frontend hides unavailable actions, but frontend visibility is never the security boundary.
- Some inaccessible trips return `404` rather than `403` to reduce ID enumeration.
- A user cannot accept an invitation sent to another authenticated email.

### Internal service authentication

- Identity internal routes require `INTERNAL_SERVICE_SECRET`.
- Internal routes are not proxied through the public Gateway.
- Production startup rejects missing or placeholder internal secrets.

### Guest access

- Guest tokens are generated from cryptographically secure random bytes.
- Only SHA-256 guest-token hashes are stored.
- Access is read-only, limited to one trip, expiring, and revocable.
- Guest responses expose a reduced projection rather than administrative data.

### HTTP controls

- Express services use Helmet.
- Production Gateway CORS allows only the configured frontend origin.
- The Gateway rate-limits general API traffic and applies a stricter authentication limit.
- JSON body parsing is centralized.
- Production access logging uses the combined format and excludes health probes.
- Services validate required production configuration before listening.

### Database controls

- Identity and Trip data are separated into service-owned databases.
- Case-insensitive unique constraints protect emails and trip names.
- Role check constraints limit stored trip roles.
- Token and relationship uniqueness is enforced in PostgreSQL.
- Identity token tables cascade when their user is deleted.

## 3. Secret handling

Never commit:

- `.env` or `.env.production`
- Database passwords
- JWT/internal secrets
- Resend API keys
- Database dumps
- Guest or invitation URLs captured from production

Use different values for:

- Identity DB password
- Trip DB password
- JWT signing secret
- Internal service secret

Rotate a secret immediately if it is exposed. JWT-secret rotation invalidates existing sessions. Internal-secret rotation requires synchronized Identity and Trip Service configuration.

## 4. Browser security model

The frontend stores JWT/user state in `localStorage`. This is simple and suitable for the diploma project's architecture, but any successful cross-site scripting attack could read the token.

Risk reduction currently comes from React escaping rendered values, avoiding arbitrary HTML rendering, Helmet, restricted CORS, and dependency/tooling checks. A higher-assurance production version should consider:

- Secure, `HttpOnly`, `SameSite` authentication cookies
- Explicit CSRF protection if cookie authentication is introduced
- A strict Content Security Policy tuned to frontend deployment
- Refresh-token rotation and short-lived access tokens
- Session/device management and revocation

## 5. Invitation risks

Email invitation tokens are bearer credentials. Unlike guest, verification, and reset tokens, the current Trip Service stores invitation tokens in directly usable form because they must be listed/linked by the administrator UI.

Required precautions:

- Serve all links only over HTTPS.
- Avoid logging full invitation URLs at proxies/analytics systems.
- Keep the seven-day expiry.
- Treat invitation database backups as sensitive.
- Consider hashing invitation tokens and redesigning administrative link retrieval before using the system for high-value data.

## 6. Third-party providers

TripBuddy sends only the data needed for the requested integration:

- Destination/date query to Open-Meteo
- Currency pair and amount to Frankfurter
- Recipient email and transactional content to Resend

Review provider privacy terms, retention, availability, and rate limits before real-user launch. Provider responses are untrusted input and must continue to be validated/normalized by the Integration Service.

## 7. Production infrastructure checklist

Before real users:

- Use HTTPS for frontend and API with automatic certificate renewal.
- Restrict VPS firewall access; expose only the intended public HTTP(S) entry point and SSH administration.
- Do not publish PostgreSQL ports.
- Disable direct public access to ports 4001–4003.
- Use a non-root deployment/operations account where practical.
- Patch the host, Docker Engine, base images, Node dependencies, and PostgreSQL.
- Configure off-host encrypted backups and test restoration.
- Add uptime/health monitoring and alerting.
- Set log retention and prevent secret/token logging.
- Configure DNS and provider accounts with multi-factor authentication.
- Use least-privilege credentials and restrict who can read `.env.production`.

## 8. Known limitations

- JWTs in `localStorage` are not server-revocable sessions.
- There is no refresh-token lifecycle.
- Invitation tokens are stored in reusable form.
- No account lockout or CAPTCHA exists beyond Gateway rate limiting.
- There is no multi-factor authentication.
- Database initialization is automatic but there is no migration/rollback framework.
- Backups and monitoring are operational responsibilities outside the repository.
- Swagger annotations may not cover every current endpoint.
- Provider availability affects optional weather/conversion features.
- Email delivery depends on Resend configuration and sender reputation.

These limitations are acceptable for a controlled diploma demonstration with test data; they should be addressed proportionally before wider public use.

## 9. Dependency maintenance

Run component-level checks regularly:

```powershell
npm audit
```

Review findings rather than automatically applying breaking major upgrades. Update one component at a time, run TypeScript/build/tests, and verify Docker production builds.

Container base images and PostgreSQL images also require periodic rebuilding and review.

## 10. Reporting a vulnerability

Do not open a public issue containing credentials, production URLs with tokens, database contents, or a working exploit. Contact the repository owner privately with:

- Affected component and version/tag
- Reproduction steps using test data
- Expected and actual behavior
- Impact assessment
- Suggested mitigation, if known

Revoke exposed credentials before continuing investigation.
