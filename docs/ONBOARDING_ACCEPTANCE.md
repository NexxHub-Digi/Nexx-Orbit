# Verified tenant onboarding — acceptance plan

## What this increment implements
- Owner/admin creates a 256-bit, single-use invitation for one exact Google email.
- Only SHA-256 invitation digest is stored in PostgreSQL; URL embeds raw token in the hash fragment, not a request query string.
- Expires after 72 hours; owner/admin may revoke pending invitations.
- Account acceptance requires a signed, Google-verified email session and produces a tenant-scoped membership with the assigned role.
- Non-admins cannot generate/revoke invitations; guests cannot choose an owner role via invitation.
- All invite database mutations use narrow SECURITY DEFINER functions, not direct HTTP table write privileges.

## Required environments
- **Development:** dedicated Neon `nexx-orbit-dev` with migrations 001–005 applied, runtime role `orbit_api`. Migration 005 was applied and function-tested.
- **Vercel:** production or preview host must set `AUTH_APP_ORIGIN` to its EXACT HTTPS origin. For the canonical production alias, use `https://nexx-orbit.vercel.app`.
- **Google Cloud:** create a Web Application OAuth client with authorized redirect URI `https://nexx-orbit.vercel.app/api/auth/google/callback`, configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as encrypted Vercel project variables for the target environment. Do not paste secrets into the repository or chat.
- **Session:** separate `AUTH_SESSION_SECRET` of at least 32 UTF-8 bytes. Never expose it to the browser.
- **Database:** use a restricted role without SUPERUSER or BYPASSRLS; production needs a separate protected DB, not the development QA database.

## Multi-account acceptance checklist
- [ ] Verify login and logout on the canonical host using two real Google accounts; verify exact callback URI and cookie settings.
- [ ] Account A signs in, creates Tenant Alpha.
- [ ] Account A issues a builder invitation for Account B's verified Google email, then copies the one-time link.
- [ ] Account B clicks the link, signs in and accepts; confirm membership builder.
- [ ] Account B sees only authorized tenant resources and cannot invite others.
- [ ] Account B attempts to join with a different Google email: denied.
- [ ] Reuse the same token: denied.
- [ ] Account A issues and revokes a test invitation: acceptance denied.
- [ ] Account A creates Tenant Beta and confirms Tenant Alpha members cannot read its workflows, runs, agents, MCP connections or model routes.
- [ ] Repeat on mobile viewport, verify errors/empty/loading states and clipboard permission failures.
- [ ] Inspect audit and DB logs for accidental raw invitation tokens or plaintext passwords.
- [ ] Validate revoked/suspended tenant access is denied, even when a browser has cached tenant IDs.

## Completed database-level QA (23 November 2026)
- Restricted `orbit_api` role issued a tenant invite.
- Mismatched email rejected, correct verified-format Google subject accepted, assigned builder role.
- Replay rejected, non-admin issuance rejected, revoked invite acceptance rejected.
- These are database-function tests with synthetic accounts; **they do not establish live Google OAuth or browser end-to-end acceptance**.

## Outstanding release gates
1. Create authorized Google Cloud OAuth client and secure Vercel environment configuration.
2. Set up isolated production PostgreSQL database and migrations (never reuse QA tenant records).
3. Perform real browser login/invite/join tests with two distinct verified identities.
4. Enable and monitor the long-running worker in a separately funded environment.
5. Add role changes, account suspension, audit exports, and emergency invite revocation as future hardening.
