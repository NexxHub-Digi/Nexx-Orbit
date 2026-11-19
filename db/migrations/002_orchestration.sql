-- 002_orchestration.sql: additive tenant-scoped tables and RLS policies.
-- This migration may be run once on a dedicated database using the migration owner.
CREATE TABLE IF NOT EXISTS agent_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  model_route text NOT NULL DEFAULT 'default',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','enabled','disabled')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_agents_tenant_created ON agent_definitions(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS mcp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  endpoint_url text NOT NULL CHECK (length(endpoint_url) BETWEEN 10 AND 2048),
  transport text NOT NULL DEFAULT 'streamable_http' CHECK (transport='streamable_http'),
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','enabled')),
  allowed_tools text[] NOT NULL DEFAULT ARRAY[]::text[],
  secret_ref text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_mcp_tenant_created ON mcp_connections(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS model_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_key text NOT NULL CHECK (route_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  provider text NOT NULL,
  model_id text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','enabled')),
  secret_ref text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,route_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS runs_tenant_id_id_unique ON runs(tenant_id,id);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS request_key text;
CREATE UNIQUE INDEX IF NOT EXISTS runs_tenant_request_key_unique ON runs(tenant_id,request_key) WHERE request_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS run_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('queued','started','step_completed','step_failed','approval_requested','approved','rejected','retrying','completed','failed','cancelled')),
  step_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_run_events_history ON run_events(tenant_id,run_id,id);
ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE mcp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE model_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_routes FORCE ROW LEVEL SECURITY;
ALTER TABLE run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_events FORCE ROW LEVEL SECURITY;
CREATE POLICY agent_read ON agent_definitions FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=agent_definitions.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
CREATE POLICY agent_insert ON agent_definitions FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND created_by=current_setting('app.subject',true)
 AND EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=agent_definitions.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active'
 AND m.role IN ('owner','admin','builder'))
);
CREATE POLICY mcp_read ON mcp_connections FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=mcp_connections.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
CREATE POLICY mcp_insert ON mcp_connections FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND created_by=current_setting('app.subject',true)
 AND status='disabled' AND secret_ref IS NULL
 AND EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=mcp_connections.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active'
 AND m.role IN ('owner','admin','builder'))
);
CREATE POLICY model_read ON model_routes FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=model_routes.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
CREATE POLICY model_insert ON model_routes FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND created_by=current_setting('app.subject',true)
 AND status='disabled' AND secret_ref IS NULL
 AND EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=model_routes.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active'
 AND m.role IN ('owner','admin','builder'))
);
CREATE POLICY run_event_read ON run_events FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_events.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
CREATE POLICY run_event_insert ON run_events FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND actor=current_setting('app.subject',true)
 AND EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=run_events.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active'
 AND m.role IN ('owner','admin','builder','operator'))
);
CREATE POLICY workflow_builder_update ON workflows FOR UPDATE USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=workflows.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active'
 AND m.role IN ('owner','admin','builder'))
) WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=workflows.tenant_id
 AND m.subject_id=current_setting('app.subject',true) AND m.status='active'
 AND m.role IN ('owner','admin','builder'))
);
