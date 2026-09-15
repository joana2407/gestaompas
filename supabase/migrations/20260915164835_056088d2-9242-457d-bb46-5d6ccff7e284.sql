-- FÁBRICAS
CREATE TABLE public.factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  blocked_allergens text[] NOT NULL DEFAULT '{}',
  hygiene_notes text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.factories TO service_role;
ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;

-- FORNECEDORES
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  commercial_name text,
  commercial_email text,
  commercial_phone text,
  quality_name text,
  quality_email text,
  quality_phone text,
  status text NOT NULL DEFAULT 'completo',
  pending_notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- MP <-> FÁBRICA
CREATE TABLE public.material_factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_material_id, factory_id)
);
GRANT ALL ON public.material_factories TO service_role;
ALTER TABLE public.material_factories ENABLE ROW LEVEL SECURITY;

-- MP <-> FORNECEDOR
CREATE TABLE public.material_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_reference text,
  origin_country text,
  shelf_life_months integer,
  preferred boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_material_id, supplier_id)
);
GRANT ALL ON public.material_suppliers TO service_role;
ALTER TABLE public.material_suppliers ENABLE ROW LEVEL SECURITY;

-- DOCUMENTAÇÃO
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'outro',
  title text NOT NULL,
  description text,
  version text NOT NULL DEFAULT '1.0',
  issued_on date,
  expires_on date,
  storage_path text,
  original_filename text,
  notes text,
  uploaded_by text,
  superseded_by uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX documents_supplier_idx ON public.documents (supplier_id);
CREATE INDEX documents_material_idx ON public.documents (raw_material_id);

-- ALERGÉNIOS NAS MP
ALTER TABLE public.raw_materials
  ADD COLUMN allergens_formulation text[] NOT NULL DEFAULT '{}',
  ADD COLUMN allergens_contamination text[] NOT NULL DEFAULT '{}';

-- TRIGGERS updated_at
CREATE TRIGGER factories_updated BEFORE UPDATE ON public.factories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER material_factories_updated BEFORE UPDATE ON public.material_factories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER material_suppliers_updated BEFORE UPDATE ON public.material_suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AS TRÊS UNIDADES FABRIS
INSERT INTO public.factories (code, name, description, blocked_allergens, hygiene_notes) VALUES
  ('FAB1', 'Fábrica 1 · Fatiados', 'Produtos fatiados', '{}', ARRAY[
    'Croutons requerem higienização total da linha antes da produção',
    'Pão de Rabanadas deve ser o último produto da sequência',
    'Pães com sementes no topo requerem higienização após produção'
  ]),
  ('FAB2', 'Fábrica 2 · Granel', 'Produtos a granel', '{}', ARRAY[
    'Sequência: padaria → pastelaria para minimizar contaminação'
  ]),
  ('FAB3', 'Fábrica 3 · Sem Glúten', 'Produtos SG (sem glúten)', ARRAY['gluten'], ARRAY[
    'BLOQUEIO TOTAL: nenhuma MP com glúten permitida nesta fábrica',
    'Segregação física obrigatória de todas as MP com glúten'
  ]);