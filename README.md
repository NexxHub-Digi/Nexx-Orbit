# Nexx Orbit — Hybrid AI Orchestration SaaS

Tenant-isolated control plane for deterministic workflows, AI agents, model routing and MCP integrations. Built as a Next.js SaaS frontend/API, Neon PostgreSQL with strict row-level security, and a separate deterministic worker.

## What is implemented
- Next.js App Router landing screen with the original interactive **synthetic prototype** at `/demo.html`.
- OIDC/JWKS access-token verifier; real application endpoints fail closed without a configured issuer.
- Tenant-scoped APIs: tenants, workflow drafts and publish, agents, MCP registry, model route registry, run queue, events, approval decisions and step status.
- PostgreSQL migrations `001`, `002`, `003` with transaction-scoped RLS and distinct API / worker roles.
- Limited **stateless MCP 2026-07-28** read-only JSON-RPC tools for workflows, agents, and runs. No outbound MCP execution.
- Deterministic worker that completes start/noop/end nodes, pauses on approvals, resumes after decisions and **fails closed** on unconfigured model/tool/agent/condition nodes. The worker is a CLI entrypoint, not a running background service.
- CI runs policy, DAG, MCP, role and worker tests plus Next.js build.

## Start local frontend
Requires Node 20.9+.
```bash
npm install
npm run dev
npm test
npm run build
```
Visit http://localhost:3000 and http://localhost:3000/demo.html. The demo's tenant switching is simulated and does **not** grant backend access.

## Backend configuration
Copy `.env.example` to `.env.local`, then supply a trusted OIDC issuer/audience/JWKS and a **restricted** `orbit_api` database URL. `lib/server/db.js` rejects owner/worker credentials. Run migrations in numerical order as `orbit_owner` on a dedicated database. Set up restricted API and worker SQL grants as described in [docs/BACKEND_MCP.md](docs/BACKEND_MCP.md).

To provision a real organization, a trusted operator uses:
```bash
ADMIN_DATABASE_URL=... npm run tenant:provision -- --slug acme --name "Acme" --subject "verified-oidc-subject"
```
No privileged tenant self-registration endpoint exists. OIDC subject must already be verified out of band.

To execute **one** queued deterministic run on an explicitly assigned tenant:
```bash
WORKER_DATABASE_URL=... ORBIT_WORKER_TENANT_ID=... ORBIT_WORKER_SUBJECT=worker:tenant npm run worker:once
```
The worker identity must hold the active `operator` membership for that tenant, granted by a trusted provisioner. Run workers as separate processes, not Vercel request handlers. Production queue scheduling and automatic polling are **not** set up.

## API and MCP
See [docs/BACKEND_MCP.md](docs/BACKEND_MCP.md), including the route matrix, worker roles and security constraints.

## Infrastructure state
Dedicated dev Neon project: `nexx-orbit-dev` in London, PostgreSQL 17; migrations applied. QA tenants were created for direct DB isolation tests. Vercel project `nexx-orbit` was Git-linked; database URL stored encrypted for preview/dev. The first preview deployment could not launch because the Vercel team reached its daily Hobby deployment quota; no live deployment is confirmed. Live OIDC credentials are **not** configured.

## Not implemented yet
Google/OIDC onboarding UI, tenant invitations, interactive UI-to-API bindings, agent LLM calls, remote MCP client connections, credential vault, scheduled worker service, durable external side-effect retries, parallel/branching workflow execution, usage budgets and billing, billing events, full audit trail and production E2E acceptance.

Security priority: enforce tenant RBAC, workers' tenant identity, explicit capability allowlists, private-network/redirect-safe egress, idempotent actions, quotas, traceable approvals and least-privileged credentials before remote model or MCP calls.
