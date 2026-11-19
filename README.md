# Nexx Orbit — Hybrid Multi-Tenant AI Orchestration SaaS

Nexx Orbit combines a Next.js SaaS control plane, Google OIDC login, tenant-scoped APIs, Neon PostgreSQL RLS and a separate orchestration dispatcher.

## Delivered in code
- **Identity:** Google OpenID Connect authorization-code + PKCE + state + nonce, verified Google ID token, signed HttpOnly 8-hour session, exact-origin CSRF checks; alternative trusted OIDC Bearer JWT API support.
- **Tenant onboarding:** `POST /api/v1/tenants` invokes a narrow privileged SQL provisioning function with per-identity limits, owner membership and dispatcher assignment. Database row-level security protects tenant resources.
- **Real UI:** `/workspace` displays actual tenant API records, supports organization creation and switching, workflow drafts/publishing, run queueing, approval decisions, agent drafts, MCP endpoint registry and model routes. `/demo.html` remains a synthetic interactive showcase.
- **Orchestration:** DAG validation, versioned draft publishing, idempotent queueing, event/step persistence, human approval gates, and deterministic start/noop/end nodes.
- **Worker:** `npm run worker:serve` is a continuously polling **process entrypoint** with multi-tenant membership enumeration. External agent, model and MCP operations remain intentionally disabled until safely integrated.
- **MCP:** authenticated read-only stateless JSON-RPC subset (workflow/agent/run listing); outbound MCP registry entries disabled.
- **CI:** Node unit tests and Next production build in GitHub Actions.

## Repository setup
Requires Node 20.9+.

```sh
npm install
npm test
npm run build
npm run dev
```

Use `/login` for Google sign-in and `/workspace` for authenticated data. Configure environment variables based on `.env.example`. No OAuth, database or API secrets belong in GitHub. See `docs/GOOGLE_AUTH.md`, `docs/BACKEND_MCP.md` and `docs/WORKER_SERVICE.md`.

### Google Cloud setup required
Create a Web application OAuth client with callback `https://<app-host>/api/auth/google/callback`; configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_APP_ORIGIN`, `AUTH_SESSION_SECRET`. The Google sign-in flow cannot work without these real settings and matching authorized origins.

### Database and worker
Neon project `nexx-orbit-dev` (dev only), PostgreSQL 17, migrations 001–004 applied. Separate runtime roles `orbit_api` and `orbit_worker` without SUPERUSER/BYPASSRLS. Use `orbit_api` for the Next.js server, `orbit_worker` for the separate service. Tenant SQL onboarding is validated with the restricted API role and explicit tenant-isolation checks.

Start the dispatcher in a dedicated worker process:
```sh
WORKER_DATABASE_URL=... ORBIT_WORKER_SUBJECT=worker:orbit-dispatcher npm run worker:serve
```

Provisioned tenants receive `worker:orbit-dispatcher` as an `operator` membership. The service loops over authorized active tenants and records execution events transactionally.

### Deployment
Orbit is Git-linked to Vercel. The Vercel Hobby account's daily deployment cap prevented the preview. The restricted DATABASE_URL and randomly generated AUTH_SESSION_SECRET values were stored as encrypted project environment variables; OAuth client credentials and canonical app origin still require configuration. The Render worker Blueprint in `render.yaml` is **plan only**: Render reported `need_payment_info` and no continuous worker deployment was created.

## Production acceptance still outstanding
- Configure Google Cloud client and exact canonical deployment origin; test real login/callback/logout.
- Complete browser API integration under two real accounts and tenant permission combinations.
- Deploy and monitor a dedicated 24/7 worker; test approval/restart/retry/failover.
- Add tenant invitations, roles UI, credential vault, outbound MCP adapter protections, model calls, retries, quotas, billing, metering and audit logs.
- Harden session revocation, platform administration, published workflow immutability and privileged operations before production launch.

**Do not represent the UI prototype or passing CI as production integration acceptance.**
