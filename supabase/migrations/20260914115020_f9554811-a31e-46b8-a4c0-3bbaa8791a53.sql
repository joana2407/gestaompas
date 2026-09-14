CREATE TABLE public.raw_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT,
  kind TEXT NOT NULL DEFAULT 'simples',
  origins TEXT[] NOT NULL DEFAULT '{}',
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.raw_material_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  origin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rmi_rm_idx ON public.raw_material_ingredients(raw_material_id);

CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_label TEXT NOT NULL,
  week_start DATE,
  source_filename TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  summary TEXT,
  total_alerts INTEGER NOT NULL DEFAULT 0,
  total_at_risk INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rasff_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  reference TEXT,
  product TEXT NOT NULL,
  hazard TEXT,
  hazard_type TEXT,
  origin_country TEXT,
  manufacturer TEXT,
  notified_on DATE,
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alerts_analysis_idx ON public.rasff_alerts(analysis_id);

CREATE TABLE public.risk_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES public.rasff_alerts(id) ON DELETE CASCADE,
  raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  raw_material_name TEXT NOT NULL,
  raw_material_kind TEXT,
  ingredient_name TEXT,
  risk_level TEXT NOT NULL,
  risk_type TEXT,
  reason TEXT,
  recommendation TEXT,
  traceability TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX findings_analysis_idx ON public.risk_findings(analysis_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_materials TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_material_ingredients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rasff_alerts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_findings TO anon, authenticated;
GRANT ALL ON public.raw_materials TO service_role;
GRANT ALL ON public.raw_material_ingredients TO service_role;
GRANT ALL ON public.analyses TO service_role;
GRANT ALL ON public.rasff_alerts TO service_role;
GRANT ALL ON public.risk_findings TO service_role;

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rasff_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open access raw_materials" ON public.raw_materials FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access raw_material_ingredients" ON public.raw_material_ingredients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access analyses" ON public.analyses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access rasff_alerts" ON public.rasff_alerts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access risk_findings" ON public.risk_findings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER rm_updated BEFORE UPDATE ON public.raw_materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER an_updated BEFORE UPDATE ON public.analyses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rf_updated BEFORE UPDATE ON public.risk_findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();