# Continuous multi-tenant dispatcher

## Entrypoint
`npm run worker:serve` keeps a Node.js process alive, queries tenant memberships assigned to `worker:orbit-dispatcher`, and repeatedly calls `processNextRun`. Configure `WORKER_DATABASE_URL` for the Neon `orbit_worker` database role, plus `ORBIT_WORKER_SUBJECT=worker:orbit-dispatcher`. The poll interval defaults to 3000ms and is restricted to 1–60 seconds.

Each cycle enumerates only active `operator` memberships visible through PostgreSQL RLS. Each tenant's runs and steps are processed in a transaction with tenant-local identity context and `FOR UPDATE SKIP LOCKED` to avoid two workers claiming the same run. Queued runs progress; human gates remain pending until owner/admin approves. Waiting runs without an approval decision are skipped by the dispatcher query to avoid hot loops.

The worker implements a **limited deterministic vertical slice**:
- start, noop and end nodes auto-complete.
- approval/manual nodes require a signed-in tenant owner/admin decision via the approval API.
- agent, model, MCP tool, parallel, delay, conditions and other external actions deliberately fail closed.
- It does not yet support distributed retries with a transactional outbox, tenant priority fairness, attempts/backoff, dead-letter processing, usage quotas, or provider calls.

## Render blueprint
`render.yaml` describes one **paid** Render Background Worker in Frankfurt. Creating a Blueprint plan does not start the service. An explicit operator approval, a restricted Neon worker connection secret and billing acceptance are necessary before applying the plan. The Render worker must be a different process from the Next.js Vercel deployment.

## Operator validation
1. Use separate `orbit_worker` connection, never the migration owner.
2. Validate dispatcher membership on new tenant creation.
3. Start a queued start→noop→end run and verify `completed`, three step checkpoints, and events.
4. Start start→approval→end, assert waiting_approval and no autonomous approval.
5. Approve as tenant owner, verify worker resumes to completed.
6. Verify that cross-tenant identities cannot read or update another tenant's runs.
7. Configure alerts for worker errors, processing backlog and approval age before production use.
