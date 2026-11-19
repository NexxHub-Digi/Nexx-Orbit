# Backend APIs and MCP foundation (phase 1)

## Infrastructure
Neon development project: `nexx-orbit-dev` (project ID `rough-scene-47898974`), branch `br-mute-pond-bj9k3lbx`, database `orbit`, region `aws-eu-west-2`. Dedicated to Orbit; no other Nexx product database was reused.
Migrations `001_foundation.sql` and `002_orchestration.sql` applied to its empty development database. No customer data migrated. Separate `orbit_api` runtime role created; verified `rolsuper=false` and `rolbypassrls=false`. Keep privileged migration credentials out of the web API. To deploy, explicitly configure a restricted `DATABASE_URL` and trusted OIDC JWT issuer/audience/JWKS in server-only environment variables.

## Live code surface (routes still require a configured deployment)
| Verb | Path | Description |
|---|---|---|
| GET | /api/health | Liveness, explicitly not database readiness |
| GET | /api/v1/tenants | My active tenant memberships |
| GET/POST | /api/v1/workflows | List/create tenant workflow draft |
| POST | /api/v1/workflows/{workflowId}/publish?tenant_id=UUID | Validate DAG and publish draft |
| GET/POST | /api/v1/agents | List/create agent definitions (draft only) |
| GET/POST | /api/v1/mcp-connections | List/register remote MCP endpoint (disabled) |
| GET/POST | /api/v1/model-routes | List/register model route (disabled) |
| GET/POST | /api/v1/runs | List/queue runs; POST supports Idempotency-Key header |
| GET | /api/v1/runs/{runId}/events?tenant_id=UUID | Tenant-only immutable event history |
| POST | /api/mcp | Stateless, authenticated MCP read-only discovery of tenant workflows/agents/runs |

All CRUD routes are guarded by OIDC token verification and explicit membership verification. Tenant ID is not trusted by itself. Runs are inserted as `queued` with a `queued` event, and will NOT execute until a worker is wired.

### MCP protocol support
Implements **limited** 2026-07-28 stateless Streamable HTTP JSON-RPC subset (POST JSON responses, `tools/list`, `tools/call`). Requires `MCP-Protocol-Version: 2026-07-28`, `Mcp-Method`, `Mcp-Name` for calls, and version in `params._meta["io.modelcontextprotocol/protocolVersion"]`. Public-facing route requires the same verified JWT identity as the application API. Advertised tools are read-only and still enforce tenant membership. This is **not** a full MCP host implementation; server/discover, OAuth Protected Resource Metadata, capability negotiation, extensions, subscriptions, tools for mutation, remote MCP clients and egress enforcement remain pending. MCP connection registry entries are disabled by default, cannot hold client-submitted secrets, and never initiate external fetches.

### Execution lifecycle
1. Builder creates graph draft.
2. Builder publishes after deterministic DAG compilation.
3. Operator supplies a stable `Idempotency-Key` header when queueing a run.
4. Server stores run and immutable queued event atomically.
5. **Next phase:** workers claim queued runs with tenant identity, persist step transitions/retries, enforce agent budgets and approval pauses, then call approved provider/tool adapters.
6. Approvals, model execution, MCP outbound proxy, metrics, billing and event streaming are NOT built.

### Tenant security checklist
- Verify real OIDC issuer + Google OAuth setup and callback flows.
- Use the `orbit_api` connection role (never `orbit_owner`) in deployment.
- In dev, test same-subject memberships across two tenants plus explicit cross-tenant denial.
- RLS policies use transaction-local `set_config` with verified subject and tenant.
- Egress gateway MUST block local/private/metadata IPs after DNS resolution and after redirects, and enforce tenant-scoped tool ACL before any remote MCP call.
- Add tenant-level quotas, tracing, audit/export, secrets vault and consented privileged support access.

## Proof / verification status
Neon migrations and restricted-role creation are confirmed by connected tools. GitHub CI must pass tests and Next build for each commit. Full authenticated UI E2E, API integration, real provider calls, live MCP client compatibility, app deployment and durable worker execution require further work.
