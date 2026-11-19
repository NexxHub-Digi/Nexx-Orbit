-- Secure self-onboarding: only callable with a server-verified subject context.
CREATE OR REPLACE FUNCTION public.provision_orbit_tenant(p_name text, p_slug text)
RETURNS TABLE(tenant_id uuid, tenant_name text, tenant_slug text, tenant_role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $body$
DECLARE v_subject text:=current_setting('app.subject',true); v_tenant uuid; v_count integer;
BEGIN
 IF v_subject IS NULL OR length(v_subject)<8 OR length(v_subject)>250 THEN RAISE EXCEPTION 'Verified identity required' USING ERRCODE='28000'; END IF;
 IF p_name IS NULL OR length(btrim(p_name))<2 OR length(btrim(p_name))>120 THEN RAISE EXCEPTION 'Invalid organization name' USING ERRCODE='22023'; END IF;
 IF p_slug IS NULL OR length(p_slug)>70 OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Invalid organization slug' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_subject,99821));
 SELECT count(*) INTO v_count FROM public.tenant_memberships m WHERE m.subject_id=v_subject AND m.role='owner' AND m.status='active';
 IF v_count>=3 THEN RAISE EXCEPTION 'Organization limit reached' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.tenants(name,slug) VALUES(btrim(p_name),p_slug) RETURNING id INTO v_tenant;
 INSERT INTO public.tenant_memberships(tenant_id,subject_id,role,status) VALUES(v_tenant,v_subject,'owner','active');
 INSERT INTO public.tenant_memberships(tenant_id,subject_id,role,status) VALUES(v_tenant,'worker:orbit-dispatcher','operator','active');
 RETURN QUERY SELECT v_tenant,btrim(p_name),p_slug,'owner'::text;
END; $body$;
REVOKE ALL ON FUNCTION public.provision_orbit_tenant(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_orbit_tenant(text,text) TO orbit_api;
