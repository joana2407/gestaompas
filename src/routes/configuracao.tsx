import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { gateStatus } from "@/lib/gate.functions";
import { PERMISSIONS, deleteTeamUser, listTeamUsers, saveTeamUser } from "@/lib/users.functions";

export const Route = createFileRoute("/configuracao")({
  head: () => ({
    meta: [
      { title: "Configuração de utilizadores | Gestão MP A&S" },
      { name: "description", content: "Gestão de utilizadores, PINs e permissões da equipa de qualidade." },
      { property: "og:title", content: "Configuração de utilizadores | Gestão MP A&S" },
      { property: "og:description", content: "Gestão de utilizadores, PINs e permissões da equipa de qualidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfigPage,
});

type Draft = { id?: string; name: string; role: string; pin: string; permissions: string[]; active: boolean };
const EMPTY: Draft = { name: "", role: "Tec. Qualidade", pin: "", permissions: ["editar_mp", "fornecedores_docs", "analises_rasff"], active: true };

function ConfigPage() {
  const qc = useQueryClient();
  const { data: gate } = useQuery({ queryKey: ["gate_status"], queryFn: () => gateStatus() });
  const canManage = gate?.user?.permissions?.includes("gerir_utilizadores") ?? false;
  const { data: users, isLoading } = useQuery({
    queryKey: ["team_users"],
    queryFn: () => listTeamUsers(),
    enabled: canManage,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await saveTeamUser({ data: draft });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Utilizador guardado.");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["team_users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Eliminar o acesso de ${name}?`)) return;
    const res = await deleteTeamUser({ data: { id } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Acesso eliminado.");
    await qc.invalidateQueries({ queryKey: ["team_users"] });
  }

  if (gate && !canManage) {
    return (
      <AppShell title="Configuração">
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Apenas a Responsável de Qualidade pode gerir utilizadores e permissões.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Configuração de utilizadores"
      description="Crie acessos, defina PINs e atribua permissões à equipa."
      actions={
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="size-4" /> Novo utilizador
        </Button>
      }
    >
      {draft && (
        <div className="mb-6 space-y-4 rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <UserCog className="size-4" /> {draft.id ? "Editar utilizador" : "Novo utilizador"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Nome
              <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="text-sm">
              Função
              <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
            </label>
            <label className="text-sm">
              {draft.id ? "Novo PIN (opcional)" : "PIN"}
              <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" inputMode="numeric" maxLength={8}
                value={draft.pin} onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, "") })} />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Permissões</legend>
            {PERMISSIONS.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.permissions.includes(p.id)}
                  onChange={(e) => setDraft({
                    ...draft,
                    permissions: e.target.checked ? [...draft.permissions, p.id] : draft.permissions.filter((x) => x !== p.id),
                  })} />
                {p.label}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Acesso ativo
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "A guardar…" : "Guardar"}</Button>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr><th className="p-3">Nome</th><th className="p-3">Função</th><th className="p-3">Permissões</th><th className="p-3">Estado</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-3" colSpan={5}>A carregar…</td></tr>}
            {users?.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {PERMISSIONS.filter((p) => u.permissions.includes(p.id)).map((p) => (
                      <span key={p.id} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{p.label}</span>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <span className={u.active ? "text-primary" : "text-destructive"}>{u.active ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" aria-label="Editar"
                    onClick={() => setDraft({ id: u.id, name: u.name, role: u.role, pin: "", permissions: u.permissions, active: u.active })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Eliminar" onClick={() => remove(u.id, u.name)}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
