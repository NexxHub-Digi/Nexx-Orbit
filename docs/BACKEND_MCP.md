# Backend, API, MCP and worker implementation

## Connected development infrastructure
- Dedicated Neon project: `nexx-orbit-dev`, `rough-scene-47898974`, branch `br-mute-pond-bj9k3lbx`, database `orbit`, PostgreSQL 17, region `aws-eu-west-2`.
- Migrations `001_foundation.sql`, `002_orchestration.sql`, `003_worker.sql` applied successfully to dedicated development database.
- Runtime DB roles `orbit_api` and `orbit_worker` verified: `rolsuper=false` and `rolbypassrls=false`; explicit grants keep tenants/memberships non-writable to public API.
- Vercel Git-linked project ID `prj_mvEFYmSUJ2SGaChfGSnsQynUMPAc`. Restricted DB URL encrypted for Preview and Development; no live OIDC provider configured, and preview is blocked by daily deployment quota.
- QA-only tenants Alpha/Beta and operator used to test RLS. Verified that subject Alpha cannot read Beta's workflows, cross-tenant INSERT fails with SQLSTATE 42501, and the worker cannot see Beta's run data.

## Authenticated routes (implementation, not live deployment acceptance)
| Verb | Path | Role / behavior |
|---|---|---|
| GET | /api/health | Public process liveness; does not verify database |
| GET | /api/v1/tenants | Authenticated member's accessible tenants |
| GET/POST | /api/v1/workflows | Member read, builder create |
| POST | /api/v1/workflows/{id}/publish?tenant_id=UUID | Builder validates DAG, publishes draft |
| GET/POST | /api/v1/agents | Member read, builder creates draft |
| GET/POST | /api/v1/mcp-connections | Member read, builder registers disabled connector |
| GET/POST | /api/v1/model-routes | Member read, admin registers disabled model route |
| GET/POST | /api/v1/runs | Member read, operator queue published workflow; optional Idempotency-Key |
| GET | /api/v1/runs/{id}/events?tenant_id=UUID | Read run events |
| GET | /api/v1/runs/{id}/steps?tenant_id=UUID | Read step checkpoint states |
| POST | /api/v1/runs/{id}/approvals/{stepId} | Owner/admin decide pending gate with `{tenant_id,decision}` |
| POST | /api/mcp | Limited stateless MCP JSON-RPC `tools/list` and `tools/call` |

The API never trusts tenant IDs or roles from the browser without database membership, and every read/write uses transaction-local subject + tenant settings. The MCP tool names are `orbit_list_workflows`, `orbit_list_agents`, `orbit_list_runs`. They are read-only, and every call requires a verified Bearer OIDC token. Supports a **subset** of the MCP 2026-07-28 Streamable HTTP contract with mirrored method/name headers; not full protocol implementation. Remote MCP connections are **registered only**, never called.

## Deterministic worker, approval gates
`npm run worker:once` uses `WORKER_DATABASE_URL` for restricted `orbit_worker` and explicitly provisioned `worker:...` subject with `operator` membership for a **single** configured tenant. In one transaction it claims the oldest queued/waiting-approval run with `FOR UPDATE SKIP LOCKED`, logs events, checkpoints each step, pauses on approval/manual nodes, and completes start/noop/end nodes. Decisions are recorded with unique keys; a worker resume checks `run_approvals`. Unsupported node types (agent, tool, parallel, condition, delay) are marked failed with explanation; none invoke external services. This gives a safe vertical slice, not yet an always-on orchestrator.

## Next production gates
1. Configure trusted OIDC issuer + Google login + callback and tenant onboarding/invitations (with tenant owner provisioning).
2. Re-enable Vercel preview after the team quota resets or the user adjusts their plan. Test live auth and database RLS from the deployed URL.
3. Add tenant-dispatched scheduler/worker service and transactional outbox for jobs.
4. Implement model-provider credential vault, safe outbound MCP client, SSRF/rebinding/redirect protection, tool scope policies, budgets, telemetry and audited approvals.
5. Introduce safe execution backends, parallelism and retry/idempotency for side effects, and cross-tenant authenticated E2E suites.
