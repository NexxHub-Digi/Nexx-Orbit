-- 005_tenant_invitations.sql
-- Owners/admins issue short-lived invitations. Only a verified Google session can accept.
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 email_normalized text NOT NULL CHECK(length(email_normalized) BETWEEN 3 AND 254),
 role text NOT NULL CHECK(role IN ('admin','builder','operator','viewer')),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '72 hours',
 accepted_by text, accepted_at timestamptz, revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_orbit_invites_tenant ON public.tenant_invitations(tenant_id,created_at DESC);
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations FORCE ROW LEVEL SECURITY;
-- No direct table privileges for orbit_api: all writes use audited, permission-checking functions.
CREATE OR REPLACE FUNCTION public.orbit_issue_invite(p_tenant uuid,p_email text,p_role text,p_hash text)
RETURNS TABLE(invitation_id uuid,invited_email text,invited_role text,expires_on timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE actor text:=current_setting('app.subject',true); email text:=lower(btrim(p_email)); inv uuid; expires timestamptz; pending_count integer;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id
  WHERE m.tenant_id=p_tenant AND m.subject_id=actor AND m.status='active' AND
  m.role IN ('owner','admin') AND t.status='active') THEN
  RAISE EXCEPTION 'Tenant administration required' USING ERRCODE='42501'; END IF;
 IF email IS NULL OR length(email) NOT BETWEEN 3 AND 254 OR
  email !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' THEN
  RAISE EXCEPTION 'Invalid email' USING ERRCODE='22023'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('admin','builder','operator','viewer') THEN
  RAISE EXCEPTION 'Invalid invited role' USING ERRCODE='22023'; END IF;
 IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid invitation hash' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,91642));
 SELECT count(*) INTO pending_count FROM public.tenant_invitations i
  WHERE i.tenant_id=p_tenant AND i.status='pending' AND i.expires_at>now();
 IF pending_count>=100 THEN RAISE EXCEPTION 'Too many pending invitations' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenant_invitations i WHERE i.tenant_id=p_tenant
   AND i.email_normalized=email AND i.status='pending' AND i.expires_at>now()) THEN
   RAISE EXCEPTION 'An invitation is already pending for this email' USING ERRCODE='23505'; END IF;
 INSERT INTO public.tenant_invitations(tenant_id,email_normalized,role,token_hash,created_by)
 VALUES(p_tenant,email,p_role,p_hash,actor) RETURNING id,expires_at INTO inv,expires;
 RETURN QUERY SELECT inv,email,p_role,expires;
END;$fn$;
CREATE OR REPLACE FUNCTION public.orbit_list_invites(p_tenant uuid)
RETURNS TABLE(invitation_id uuid,invited_email text,invited_role text,invite_status text,expires_on timestamptz,created_on timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE actor text:=current_setting('app.subject',true);
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id
  WHERE m.tenant_id=p_tenant AND m.subject_id=actor AND m.status='active'
  AND m.role IN ('owner','admin') AND t.status='active') THEN
   RAISE EXCEPTION 'Tenant administration required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT i.id,i.email_normalized,i.role,
   CASE WHEN i.status='pending' AND i.expires_at<=now() THEN 'expired' ELSE i.status END,
   i.expires_at,i.created_at FROM public.tenant_invitations i
  WHERE i.tenant_id=p_tenant ORDER BY i.created_at DESC LIMIT 100;
END;$fn$;
CREATE OR REPLACE FUNCTION public.orbit_revoke_invite(p_tenant uuid,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE actor text:=current_setting('app.subject',true); n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id
  WHERE m.tenant_id=p_tenant AND m.subject_id=actor AND m.status='active'
  AND m.role IN ('owner','admin') AND t.status='active') THEN
   RAISE EXCEPTION 'Tenant administration required' USING ERRCODE='42501'; END IF;
 UPDATE public.tenant_invitations i SET status='revoked',revoked_at=now()
  WHERE i.id=p_id AND i.tenant_id=p_tenant AND i.status='pending';
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END;$fn$;
CREATE OR REPLACE FUNCTION public.orbit_accept_invite(p_hash text,p_verified_email text)
RETURNS TABLE(joined_tenant uuid,organization text,joined_role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE actor text:=current_setting('app.subject',true); email text:=lower(btrim(p_verified_email));
 inv public.tenant_invitations%ROWTYPE; org_name text;
BEGIN
 IF actor IS NULL OR actor !~ '^google:.{3,}$' THEN
  RAISE EXCEPTION 'Verified Google identity required' USING ERRCODE='28000'; END IF;
 IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid invitation token' USING ERRCODE='22023'; END IF;
 SELECT i.* INTO inv FROM public.tenant_invitations i JOIN public.tenants t ON t.id=i.tenant_id
  WHERE i.token_hash=p_hash AND t.status='active' FOR UPDATE OF i;
 IF NOT FOUND OR inv.status<>'pending' OR inv.expires_at<=now() OR
  inv.email_normalized IS DISTINCT FROM email THEN
  RAISE EXCEPTION 'Invalid, expired or unauthorized invitation' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenant_memberships m
  WHERE m.tenant_id=inv.tenant_id AND m.subject_id=actor) THEN
  RAISE EXCEPTION 'Account already has a membership' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.tenant_memberships(tenant_id,subject_id,role,status)
  VALUES(inv.tenant_id,actor,inv.role,'active');
 UPDATE public.tenant_invitations i SET status='accepted',accepted_by=actor,accepted_at=now() WHERE i.id=inv.id;
 SELECT t.name INTO org_name FROM public.tenants t WHERE t.id=inv.tenant_id;
 RETURN QUERY SELECT inv.tenant_id,org_name,inv.role;
END;$fn$;
REVOKE ALL ON FUNCTION public.orbit_issue_invite(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orbit_list_invites(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orbit_revoke_invite(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orbit_accept_invite(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orbit_issue_invite(uuid,text,text,text) TO orbit_api;
GRANT EXECUTE ON FUNCTION public.orbit_list_invites(uuid) TO orbit_api;
GRANT EXECUTE ON FUNCTION public.orbit_revoke_invite(uuid,uuid) TO orbit_api;
GRANT EXECUTE ON FUNCTION public.orbit_accept_invite(text,text) TO orbit_api;
