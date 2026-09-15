import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Star } from "lucide-react";

import { AllergenTags } from "@/components/AllergenTags";
import { AppShell } from "@/components/AppShell";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateSupplier } from "@/lib/catalog.functions";
import { ESTADOS_COMPLETUDE } from "@/lib/domain";
import { gateStatus } from "@/lib/gate.functions";
import { supplierDetailQuery } from "@/lib/queries";

export const Route = createFileRoute("/fornecedor/$supplierId")({
  head: () => ({
    meta: [
      { title: "Ficha de fornecedor | Gestão de MP" },
      {
        name: "description",
        content: "Contactos, matérias-primas fornecidas e documentação com versões e validade de cada fornecedor.",
      },
      { property: "og:title", content: "Ficha de fornecedor" },
      { property: "og:description", content: "Documentação, versões e matérias-primas associadas ao fornecedor." },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(supplierDetailQuery(params.supplierId)),
  errorComponent: () => (
    <AppShell title="Fornecedor">
      <div className="panel p-10 text-center text-sm text-muted-foreground">Não foi possível carregar o fornecedor.</div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Fornecedor">
      <div className="panel p-10 text-center text-sm text-muted-foreground">Fornecedor não encontrado.</div>
    </AppShell>
  ),
  component: SupplierDetail,
});

function SupplierDetail() {
  const { supplierId } = Route.useParams();
  const { data } = useSuspenseQuery(supplierDetailQuery(supplierId));
  const supplier = data.supplier;
  const [editing, setEditing] = useState(false);

  if (!supplier) {
    return (
      <AppShell title="Fornecedor">
        <div className="panel p-10 text-center text-sm text-muted-foreground">Fornecedor não encontrado.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={supplier.name}
      description={supplier.code ? `Código ${supplier.code}` : ""}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/fornecedores">
              <ArrowLeft className="mr-2 size-4" /> Fornecedores
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Fechar edição" : "Editar dados"}
          </Button>
        </div>
      }
    >
      {editing ? <SupplierEdit supplier={supplier} onClose={() => setEditing(false)} /> : <SupplierSummary supplier={supplier} />}

      <section className="panel my-4 p-4">
        <h2 className="font-display mb-3 text-base font-semibold">Matérias-primas fornecidas</h2>
        {data.links.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma matéria-prima associada. Associe na ficha da matéria-prima.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.links.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/materia-prima/$materialId"
                    params={{ materialId: link.raw_material_id }}
                    className="text-sm font-semibold hover:underline"
                  >
                    {link.raw_materials?.name ?? "Matéria-prima"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {link.supplier_reference ? `Ref. ${link.supplier_reference}` : "sem referência"}
                    {link.origin_country ? ` · origem ${link.origin_country}` : ""}
                    {link.shelf_life_months ? ` · validade ${link.shelf_life_months} meses` : ""}
                  </p>
                </div>
                <AllergenTags
                  formulation={link.raw_materials?.allergens_formulation ?? []}
                  contamination={link.raw_materials?.allergens_contamination ?? []}
                  empty="—"
                />
                {link.preferred ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Star className="size-3.5" /> Preferencial
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DocumentsPanel
        documents={data.documents}
        suppliers={[{ id: supplier.id, name: supplier.name }]}
        materials={data.links.map((l) => ({ id: l.raw_material_id, name: l.raw_materials?.name ?? "MP" }))}
        fixedSupplierId={supplier.id}
        title="Documentação do fornecedor"
      />
    </AppShell>
  );
}

type Supplier = {
  id: string;
  name: string;
  code: string | null;
  commercial_name: string | null;
  commercial_email: string | null;
  commercial_phone: string | null;
  quality_name: string | null;
  quality_email: string | null;
  quality_phone: string | null;
  status: string;
  pending_notes: string | null;
};

function SupplierSummary({ supplier }: { supplier: Supplier }) {
  const rows = [
    ["Contacto comercial", supplier.commercial_name, supplier.commercial_email, supplier.commercial_phone],
    ["Contacto de qualidade", supplier.quality_name, supplier.quality_email, supplier.quality_phone],
  ] as const;
  return (
    <section className="panel p-4">
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(([label, name, email, phone]) => (
          <div key={label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
            <p className="text-sm">{name || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {email || "sem email"} · {phone || "sem telefone"}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm">
        <span className="text-muted-foreground">Estado documental: </span>
        {ESTADOS_COMPLETUDE.find((e) => e.id === supplier.status)?.label ?? supplier.status}
      </p>
      {supplier.pending_notes ? <p className="mt-1 text-xs text-muted-foreground">{supplier.pending_notes}</p> : null}
    </section>
  );
}

function SupplierEdit({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    name: supplier.name,
    code: supplier.code ?? "",
    commercial_name: supplier.commercial_name ?? "",
    commercial_email: supplier.commercial_email ?? "",
    commercial_phone: supplier.commercial_phone ?? "",
    quality_name: supplier.quality_name ?? "",
    quality_email: supplier.quality_email ?? "",
    quality_phone: supplier.quality_phone ?? "",
    status: supplier.status,
    pending_notes: supplier.pending_notes ?? "",
  });

  function field(key: keyof typeof values) {
    return {
      value: values[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValues((v) => ({ ...v, [key]: e.target.value })),
    };
  }

  async function submit() {
    setSaving(true);
    try {
      await updateSupplier({
        data: {
          id: supplier.id,
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
      toast.success("Fornecedor atualizado.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input {...field("name")} placeholder="Nome" />
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
