-- Nexx Orbit multi-tenant SaaS foundation; run as a migration owner, NOT as the API role.
-- Requires pgcrypto for gen_random_uuid on older PostgreSQL versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id text NOT NULL CHECK (length(subject_id)>0),
  role text NOT NULL CHECK (role IN ('owner','admin','builder','operator','viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,subject_id)
);
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,id,version)
);
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL,
  workflow_version integer NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','waiting_approval','completed','failed','cancelled')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,workflow_id,workflow_version) REFERENCES workflows(tenant_id,id,version)
);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_created ON workflows(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_tenant_created ON runs(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_subject ON tenant_memberships(subject_id,status);
-- Force row-level security even for a table owner; superuser/BYPASSRLS still bypasses.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs FORCE ROW LEVEL SECURITY;
-- API role may read only its own active membership rows. This policy does not recursively query memberships.
DROP POLICY IF EXISTS membership_self_read ON tenant_memberships;
CREATE POLICY membership_self_read ON tenant_memberships FOR SELECT USING (
 subject_id = current_setting('app.subject',true) AND status='active'
);
DROP POLICY IF EXISTS tenant_member_read ON tenants;
CREATE POLICY tenant_member_read ON tenants FOR SELECT USING (
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=id
   AND m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
-- No API-level write grants to tenants or memberships: provisioning uses separate admin service.
DROP POLICY IF EXISTS workflow_member_read ON workflows;
CREATE POLICY workflow_member_read ON workflows FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=workflows.tenant_id
  AND m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
DROP POLICY IF EXISTS workflow_builder_insert ON workflows;
CREATE POLICY workflow_builder_insert ON workflows FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 created_by=current_setting('app.subject',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=workflows.tenant_id
  AND m.subject_id=current_setting('app.subject',true)
  AND m.status='active' AND m.role IN ('owner','admin','builder'))
);
DROP POLICY IF EXISTS run_member_read ON runs;
CREATE POLICY run_member_read ON runs FOR SELECT USING (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=runs.tenant_id
  AND m.subject_id=current_setting('app.subject',true) AND m.status='active')
);
DROP POLICY IF EXISTS run_operator_insert ON runs;
CREATE POLICY run_operator_insert ON runs FOR INSERT WITH CHECK (
 tenant_id::text=current_setting('app.tenant_id',true) AND
 created_by=current_setting('app.subject',true) AND
 EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=runs.tenant_id
  AND m.subject_id=current_setting('app.subject',true)
  AND m.status='active' AND m.role IN ('owner','admin','builder','operator'))
);
-- To finish provisioning: create restricted orbit_app role, grant schema usage and explicit
-- SELECT on tenants/memberships/workflows/runs, INSERT on workflows/runs.
-- DO NOT grant BYPASSRLS, superuser, or tenant-membership INSERT to the runtime.
