import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const PERMISSIONS = [
  { id: "editar_mp", label: "Criar e editar matérias-primas" },
  { id: "eliminar_mp", label: "Eliminar matérias-primas" },
  { id: "fornecedores_docs", label: "Gerir fornecedores e documentação" },
  { id: "analises_rasff", label: "Executar análises RASFF" },
  { id: "gerir_utilizadores", label: "Gerir utilizadores e permissões" },
] as const;

const permIds = PERMISSIONS.map((p) => p.id) as [string, ...string[]];

async function admin() {
  const { requirePermission } = await import("./gate.server");
  await requirePermission("gerir_utilizadores");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listTeamUsers = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("team_users")
    .select("id, name, role, permissions, active")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
});

const userSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  role: z.string().trim().max(60),
  pin: z.string().regex(/^\d{4,8}$/, "PIN deve ter 4 a 8 dígitos").optional().or(z.literal("")),
  permissions: z.array(z.enum(permIds)),
  active: z.boolean(),
});

export const saveTeamUser = createServerFn({ method: "POST" })
  .inputValidator((d) => userSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { hashPin, currentUser } = await import("./gate.server");
    const me = await currentUser();
    const row: Record<string, unknown> = {
      name: data.name,
      role: data.role,
      permissions: data.permissions,
      active: data.active,
    };
    if (data.pin) {
      const pin_hash = hashPin(data.pin);
      const { data: clash } = await db.from("team_users").select("id").eq("pin_hash", pin_hash).maybeSingle();
      if (clash && clash.id !== data.id) return { ok: false as const, error: "Este PIN já está atribuído a outro utilizador." };
      row["pin_hash"] = pin_hash;
    }
    if (data.id) {
      const { data: existing } = await db.from("team_users").select("name").eq("id", data.id).maybeSingle();
      if (existing?.name === me?.name && (!data.active || !data.permissions.includes("gerir_utilizadores")))
        return { ok: false as const, error: "Não pode retirar a sua própria permissão de gestão ou desativar-se." };
      const { error } = await db.from("team_users").update(row).eq("id", data.id);
      if (error) return { ok: false as const, error: error.message };
    } else {
      if (!data.pin) return { ok: false as const, error: "Indique um PIN para o novo utilizador." };
      const { error } = await db.from("team_users").insert(row as never);
      if (error) return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

export const deleteTeamUser = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { currentUser } = await import("./gate.server");
    const me = await currentUser();
    const { data: u } = await db.from("team_users").select("name").eq("id", data.id).maybeSingle();
    if (u?.name === me?.name) return { ok: false as const, error: "Não pode eliminar o seu próprio acesso." };
    await db.from("team_users").delete().eq("id", data.id);
    return { ok: true as const };
  });
