# Nexx Orbit — Hybrid AI orchestration SaaS

Nexx Orbit is a multi-tenant SaaS foundation for combining deterministic workflows with AI agents, tools/MCP integrations and governance.

## Current implementation (0.2 foundation)
- **Next.js App Router** responsive landing screen; original interactive experience preserved at `/demo.html`.
- **Authenticated server API** with OIDC/JWKS access-token validation: `GET /api/health`, `GET /api/v1/tenants`, `GET/POST /api/v1/workflows`, `GET/POST /api/v1/runs`.
- **Neon/PostgreSQL migration** with tenants, memberships, workflow graphs, run records, FORCE RLS, tenant context and action-level checks.
- **Unit tests and GitHub CI**. No production secrets committed.

### Critical scope distinctions
The interactive prototype remains **in-memory demo only**. It is not connected to auth or database APIs. API access **requires** valid OIDC JWTs and actual database memberships; no role is assigned from user-supplied browser values. Run creation writes a queued record; no worker executes it. Provisioning, account invitation, deployed identity provider, live database, AI model gateway, payment/billing, agent runner, audit logs, event queue and production security acceptance remain outstanding.

## Run locally
Requires Node.js 20.9+. From the repository root:
```bash
npm install
npm run dev
npm test
npm run build
```
Open http://localhost:3000 and http://localhost:3000/demo.html.

## Configure backend
Copy `.env.example` to `.env.local`. Set `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` and `DATABASE_URL` (server-only). Missing configuration returns a 503 rather than bypassing authentication.
Run `db/migrations/001_foundation.sql` with a separate database migration/admin role. Provision an application role `orbit_app` **without** superuser, BYPASSRLS, or table-owner privileges, and grant only schema usage, SELECT on the four tables and INSERT on workflows/runs. Never use your migration owner connection string for public HTTP APIs.
New tenants and memberships must be provisioned by a separate privileged, audited administrative process, never by self-selected client roles.

## API
Bearer OIDC access token required (except health).
- `GET /api/v1/tenants` — list the active memberships for current subject
- `GET /api/v1/workflows?tenant_id=UUID` — member-only workflow list
- `POST /api/v1/workflows`: `{"tenant_id":"UUID","name":"A workflow","description":"","graph":{"nodes":[],"edges":[]}}`
- `GET /api/v1/runs?tenant_id=UUID` — member-only run records
- `POST /api/v1/runs`: `{"tenant_id":"UUID","workflow_id":"UUID"}` — queue record only, published workflows only.

## Architecture and roadmap
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Production gates
- JWT provider and Google sign-in wired, explicit tenant invitation/acceptance
- Real Neon migrations and RLS tests using **runtime** DB role
- Tenant ownership/admin provisioning service and audit logging
- Browser-to-API implementation, E2E tests and server-side role enforcement
- Durable agent/worker engine, idempotency, retries, approvals, budgets and webhook signing
- Threat model, rate limits, observability and deployment verification
