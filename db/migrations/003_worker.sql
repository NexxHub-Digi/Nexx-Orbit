-- 003_worker.sql — additive durable, per-tenant step states and approvals.
CREATE TABLE IF NOT EXISTS run_step_states (
 tenant_id uuid NOT NULL,
 run_id uuid NOT NULL,
 step_id text NOT NULL CHECK (length(step_id) BETWEEN 1 AND 128),
 node_type text NOT NULL,
 status text NOT NULL CHECK (status IN ('completed','pending_approval','failed')),
 output jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,run_id,step_id),
 FOREIGN KEY (tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS run_approvals (
 tenant_id uuid NOT NULL,
 run_id uuid NOT NULL,
 step_id text NOT NULL CHECK (length(step_id) BETWEEN 1 AND 128),
 decision text NOT NULL CHECK (decision IN ('approved','rejected')),
 decided_by text NOT NULL,
 decided_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,run_id,step_id),
 FOREIGN KEY (tenant_id,run_id,step_id) REFERENCES run_step_states(tenant_id,run_id,step_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_run_steps ON run_step_states(tenant_id,run_id);
ALTER TABLE run_step_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_step_states FORCE ROW LEVEL SECURITY;
ALTER TABLE run_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY run_step_read ON run_step_states FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_step_states.tenant_id AND
 m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
CREATE POLICY run_step_worker_insert ON run_step_states FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_step_states.tenant_id AND
 m.subject_id=current_setting('app.subject',true) AND m.status='active' AND m.role='operator')
);
CREATE POLICY run_step_worker_update ON run_step_states FOR UPDATE USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_step_states.tenant_id AND
 m.subject_id=current_setting('app.subject',true) AND m.status='active' AND m.role='operator')
) WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_step_states.tenant_id AND
 m.subject_id=current_setting('app.subject',true) AND m.status='active' AND m.role='operator')
);
CREATE POLICY run_worker_update ON runs FOR UPDATE USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=runs.tenant_id AND
 m.subject_id=current_setting('app.subject',true) AND m.status='active' AND m.role='operator')
) WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=runs.tenant_id AND
 m.subject_id=current_setting('app.subject',true) AND m.status='active' AND m.role='operator')
);
CREATE POLICY run_approval_read ON run_approvals FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_approvals.tenant_id AND
 m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
CREATE POLICY run_approval_insert ON run_approvals FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND decided_by=current_setting('app.subject',true)
 AND EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_approvals.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active' AND m.role IN ('owner','admin'))
);
