import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupplier } from "@/lib/catalog.functions";
import { ESTADOS_COMPLETUDE, validityState } from "@/lib/domain";
import { gateStatus } from "@/lib/gate.functions";
import { suppliersQuery } from "@/lib/queries";

export const Route = createFileRoute("/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores e documentação | Gestão de MP" },
      {
        name: "description",
        content:
          "Lista de fornecedores aprovados, matérias-primas fornecidas e estado da documentação exigida pelas normas BRC e AOCS.",
      },
      { property: "og:title", content: "Fornecedores e documentação" },
      { property: "og:description", content: "Contactos, matérias-primas fornecidas e documentação por fornecedor." },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(suppliersQuery),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { data } = useSuspenseQuery(suppliersQuery);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const term = search.trim().toLowerCase();
  const list = data.suppliers.filter(
    (s) => !term || s.name.toLowerCase().includes(term) || (s.code ?? "").toLowerCase().includes(term),
  );

  return (
    <AppShell
      title="Fornecedores"
      description="Contactos comerciais e de qualidade, matérias-primas fornecidas e estado da documentação."
      actions={
        <Button onClick={() => setAdding((v) => !v)}>
          <Plus className="mr-2 size-4" /> Novo fornecedor
        </Button>
      }
    >
      {adding ? <SupplierForm onClose={() => setAdding(false)} /> : null}

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar fornecedor"
          className="pl-9"
        />
      </div>

      {list.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          Sem fornecedores registados. Comece por adicionar os fornecedores aprovados.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((supplier) => {
            const materials = data.links.filter((l) => l.supplier_id === supplier.id).length;
            const docs = data.documents.filter((d) => d.supplier_id === supplier.id);
            const expired = docs.filter((d) => validityState(d.expires_on) === "expirado").length;
            const expiring = docs.filter((d) =>
              ["expira_30", "expira_60"].includes(validityState(d.expires_on)),
            ).length;
            return (
              <Link key={supplier.id} to="/fornecedor/$supplierId" params={{ supplierId: supplier.id }} className="panel block p-4 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold">{supplier.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {supplier.code ?? "sem código"}
                      {supplier.quality_name ? ` · Qualidade: ${supplier.quality_name}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {ESTADOS_COMPLETUDE.find((e) => e.id === supplier.status)?.label ?? supplier.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {materials} matéria(s)-prima · {docs.length} documento(s) ativo(s)
                </p>
                {expired > 0 || expiring > 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-high">
                    <AlertTriangle className="size-3.5" />
                    {expired > 0 ? `${expired} expirado(s)` : ""}
                    {expired > 0 && expiring > 0 ? " · " : ""}
                    {expiring > 0 ? `${expiring} a expirar` : ""}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function SupplierForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    name: "",
    code: "",
    commercial_name: "",
    commercial_email: "",
    commercial_phone: "",
    quality_name: "",
    quality_email: "",
    quality_phone: "",
    status: "pendente",
    pending_notes: "",
  });

  function field(key: keyof typeof values) {
    return {
      value: values[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValues((v) => ({ ...v, [key]: e.target.value })),
    };
  }

  async function submit() {
    if (!values.name.trim()) {
      toast.error("Indique o nome do fornecedor.");
      return;
    }
    setSaving(true);
    try {
      await createSupplier({
        data: {
          name: values.name.trim(),
          code: values.code.trim() || null,
          commercial_name: values.commercial_name.trim() || null,
          commercial_email: values.commercial_email.trim() || null,
          commercial_phone: values.commercial_phone.trim() || null,
          quality_name: values.quality_name.trim() || null,
          quality_email: values.quality_email.trim() || null,
          quality_phone: values.quality_phone.trim() || null,
          status: values.status as "completo" | "pendente" | "incompleto",
          pending_notes: values.pending_notes.trim() || null,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Fornecedor adicionado.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel mb-4 p-4">
      <h2 className="font-display mb-3 text-base font-semibold">Novo fornecedor</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Input {...field("name")} placeholder="Nome do fornecedor (obrigatório)" />
        <Input {...field("code")} placeholder="Código interno" />
        <Input {...field("commercial_name")} placeholder="Contacto comercial" />
        <Input {...field("commercial_email")} placeholder="Email comercial" />
        <Input {...field("commercial_phone")} placeholder="Telefone comercial" />
        <Input {...field("quality_name")} placeholder="Contacto de qualidade" />
        <Input {...field("quality_email")} placeholder="Email de qualidade" />
        <Input {...field("quality_phone")} placeholder="Telefone de qualidade" />
        <select
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {ESTADOS_COMPLETUDE.map((e) => (
            <option key={e.id} value={e.id}>
              Documentação {e.label.toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <Textarea className="mt-3" {...field("pending_notes")} placeholder="Documentação em falta / observações" />
      <div className="mt-3 flex gap-2">
        <Button disabled={saving} onClick={() => void submit()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Guardar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}
