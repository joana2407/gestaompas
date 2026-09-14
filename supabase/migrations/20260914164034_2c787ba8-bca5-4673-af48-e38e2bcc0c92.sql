-- Remove fully open policies on every table
DROP POLICY IF EXISTS "open access analyses" ON public.analyses;
DROP POLICY IF EXISTS "open access rasff_alerts" ON public.rasff_alerts;
DROP POLICY IF EXISTS "open access raw_materials" ON public.raw_materials;
DROP POLICY IF EXISTS "open access raw_material_ingredients" ON public.raw_material_ingredients;
DROP POLICY IF EXISTS "open access risk_findings" ON public.risk_findings;

-- Keep RLS on: with no policy, anon/authenticated get nothing
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rasff_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_findings ENABLE ROW LEVEL SECURITY;

-- Revoke Data API access from public roles; the app reaches these tables
-- only through PIN-gated server functions using the service role.
REVOKE ALL ON public.analyses FROM anon, authenticated;
REVOKE ALL ON public.rasff_alerts FROM anon, authenticated;
REVOKE ALL ON public.raw_materials FROM anon, authenticated;
REVOKE ALL ON public.raw_material_ingredients FROM anon, authenticated;
REVOKE ALL ON public.risk_findings FROM anon, authenticated;

GRANT ALL ON public.analyses TO service_role;
GRANT ALL ON public.rasff_alerts TO service_role;
GRANT ALL ON public.raw_materials TO service_role;
GRANT ALL ON public.raw_material_ingredients TO service_role;
GRANT ALL ON public.risk_findings TO service_role;