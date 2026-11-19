# Google OpenID Connect authentication setup

## Security design
Nexx Orbit uses Google OIDC Authorization Code + PKCE + nonce + state. Callback exchanges the code server-side, verifies Google's JWKS signature, issuer, audience, expiry, nonce and verified email, then issues an 8-hour HttpOnly SameSite=Lax signed session cookie. API mutation requests using cookie sessions must send an exact same-origin `Origin` header. OIDC Bearer tokens remain separately supported for service integrations.

Session cookies are **not** Google access tokens. Google refresh tokens are never requested or stored. Do not expose `GOOGLE_CLIENT_SECRET` or `AUTH_SESSION_SECRET` with `NEXT_PUBLIC_` variables.

## Google Cloud
Configure a **Web application** OAuth client in the Google Cloud Console:
- Authorized redirect URI: `https://YOUR_ORBIT_ORIGIN/api/auth/google/callback`
- For local development: `http://localhost:3000/api/auth/google/callback`.
- Configure and publish/authorize the OAuth consent screen as applicable.
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SESSION_SECRET` (at least 32 UTF-8 bytes), `AUTH_APP_ORIGIN` to the canonical app origin. `AUTH_APP_ORIGIN` must be HTTPS outside localhost.

## Routes
- `GET /login`: Sign-in experience.
- `GET /api/auth/google`: Starts code + PKCE flow.
- `GET /api/auth/google/callback`: Validates state and Google ID token; creates session.
- `GET /api/auth/session`: Returns authenticated user summary (never bearer tokens).
- `POST /api/auth/logout`: Clears the session cookie; requires exact Origin.
- `GET/POST /api/v1/tenants`: Lists memberships and creates tenant through narrow DB function.

## Limitations and rollout
- A deployed Google callback cannot work until Google Cloud OAuth credentials and the canonical Vercel domain exist. No credentials are committed.
- Current sessions last eight hours. Stateless logout clears the browser cookie; server revocation, account suspension, email allowlisting and abnormal-login monitoring are future hardening tasks.
- Production should prefer an established identity framework or managed IdP as requirements expand (enterprise SSO, refresh sessions, MFA, SCIM, etc.).
- UI sends same-origin cookie requests; there is no client-side API-key storage.
