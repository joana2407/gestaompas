CREATE TABLE public.team_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  pin_hash text NOT NULL UNIQUE,
  permissions text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.team_users TO service_role;
ALTER TABLE public.team_users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER team_users_updated BEFORE UPDATE ON public.team_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.team_users (name, role, pin_hash, permissions) VALUES
 ('Joana Pina','Resp. Qualidade', encode(sha256(convert_to('1709','UTF8')),'hex'), ARRAY['editar_mp','eliminar_mp','fornecedores_docs','analises_rasff','gerir_utilizadores']),
 ('Sabrina Esteves','Tec. Qualidade', encode(sha256(convert_to('0305','UTF8')),'hex'), ARRAY['editar_mp','fornecedores_docs','analises_rasff']),
 ('Neuza Antunes','Tec. Qualidade', encode(sha256(convert_to('0207','UTF8')),'hex'), ARRAY['editar_mp','fornecedores_docs','analises_rasff']),
 ('Rodrigo Martins','Tec. Qualidade', encode(sha256(convert_to('2607','UTF8')),'hex'), ARRAY['editar_mp','fornecedores_docs','analises_rasff']);