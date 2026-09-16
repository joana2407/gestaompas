import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Star, Trash2 } from "lucide-react";

import { AllergenPicker, AllergenTags } from "@/components/AllergenTags";
import { AppShell } from "@/components/AppShell";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteMaterial,
  removeMaterialSupplier,
  setMaterialAllergens,
  setMaterialFactories,
  setMaterialIngredients,
  updateMaterialBasics,
  updateMaterialSupplierLink,
  upsertMaterialSupplier,
} from "@/lib/catalog.functions";
import { ESTADOS_MP_FABRICA, alergenioLabel } from "@/lib/domain";
import { gateStatus } from "@/lib/gate.functions";
import { materialDetailQuery } from "@/lib/queries";


export const Route = createFileRoute("/materia-prima/$materialId")({
  head: () => ({
    meta: [
      { title: "Ficha de matéria-prima | Gestão de MP" },
      {
        name: "description",
        content:
          "Fábricas onde a matéria-prima é usada, fornecedores associados, alergénios declarados e documentação de suporte.",
      },
      { property: "og:title", content: "Ficha de matéria-prima" },
      { property: "og:description", content: "Fábricas, fornecedores, alergénios e documentação da matéria-prima." },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(materialDetailQuery(params.materialId)),
  errorComponent: () => (
    <AppShell title="Matéria-prima">
      <div className="panel p-10 text-center text-sm text-muted-foreground">
        Não foi possível carregar a matéria-prima.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Matéria-prima">
      <div className="panel p-10 text-center text-sm text-muted-foreground">Matéria-prima não encontrada.</div>
    </AppShell>
  ),
  component: MaterialDetail,
});

function MaterialDetail() {
  const { materialId } = Route.useParams();
  const { data } = useSuspenseQuery(materialDetailQuery(materialId));
  const material = data.material;

  if (!material) {
    return (
      <AppShell title="Matéria-prima">
        <div className="panel p-10 text-center text-sm text-muted-foreground">Matéria-prima não encontrada.</div>
      </AppShell>
    );
  }

  const allAllergens = [
    ...(material.allergens_formulation ?? []),
    ...(material.allergens_contamination ?? []),
  ];
  const conflicts = data.factories
    .filter((factory) => {
      const state = data.materialFactories.find((mf) => mf.factory_id === factory.id)?.state;
      if (!state || state === "inativa") return false;
      return (factory.blocked_allergens ?? []).some((a) => allAllergens.includes(a));
    })
    .map((factory) => ({
      factory,
      blocked: (factory.blocked_allergens ?? []).filter((a) => allAllergens.includes(a)),
    }));

  return (
    <AppShell
      title={material.name}
      description={[material.code, material.category, material.kind === "composta" ? "Composta" : "Simples"]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <Button variant="ghost" asChild>
          <Link to="/materias-primas">
            <ArrowLeft className="mr-2 size-4" /> Inventário
          </Link>
        </Button>
      }
    >
      {conflicts.length > 0 ? (
        <div className="mb-4 rounded-xl border border-high/30 bg-high-soft p-4 text-sm text-high">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> Incompatibilidade de alergénios
          </p>
          <ul className="mt-1 list-disc pl-5">
            {conflicts.map(({ factory, blocked }) => (
              <li key={factory.id}>
                {factory.name}: {blocked.map(alergenioLabel).join(", ")} não permitido nesta unidade.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <FactoriesCard
          materialId={materialId}
          factories={data.factories}
          current={data.materialFactories}
        />
        <AllergensCard
          materialId={materialId}
          formulation={material.allergens_formulation ?? []}
          contamination={material.allergens_contamination ?? []}
        />
      </div>

      <div className="my-4 grid gap-4 lg:grid-cols-2">
        <BasicsCard material={material} />
        <IngredientsCard
          materialId={materialId}
          ingredients={material.raw_material_ingredients ?? []}
          allergens={
            <AllergenTags
              formulation={material.allergens_formulation ?? []}
              contamination={material.allergens_contamination ?? []}
            />
          }
        />
      </div>

      <SuppliersCard materialId={materialId} links={data.materialSuppliers} suppliers={data.suppliers} />

      <div className="mt-4">
        <DocumentsPanel
          documents={data.documents}
          suppliers={data.suppliers}
          supplierOptions={data.materialSuppliers.map((l) => ({
            id: l.supplier_id,
            name: l.suppliers?.name ?? "Fornecedor",
          }))}
          supplierRequired
          materials={[{ id: material.id, name: material.name }]}
          fixedMaterialId={material.id}
          title="Documentação técnica da matéria-prima (por fornecedor)"
        />
      </div>

    </AppShell>
  );
}

function FactoriesCard({
  materialId,
  factories,
  current,
}: {
  materialId: string;
  factories: { id: string; code: string; name: string; blocked_allergens: string[] | null }[];
  current: { factory_id: string; state: string }[];
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<Record<string, string>>(
    Object.fromEntries(factories.map((f) => [f.id, current.find((c) => c.factory_id === f.id)?.state ?? "nao"])),
  );

  async function save() {
    setSaving(true);
    try {
      await setMaterialFactories({
        data: {
          materialId,
          entries: Object.entries(state)
            .filter(([, value]) => value !== "nao")
            .map(([factoryId, value]) => ({
              factoryId,
              state: value as "ativa" | "para_testes" | "inativa",
            })),
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Fábricas atualizadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel p-4">
      <h2 className="font-display mb-3 text-base font-semibold">Fábricas onde é utilizada</h2>
      <div className="space-y-2">
        {factories.map((factory) => (
          <div key={factory.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
            <span className="text-sm">{factory.name}</span>
            <select
              value={state[factory.id] ?? "nao"}
              onChange={(e) => setState((s) => ({ ...s, [factory.id]: e.target.value }))}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="nao">Não utilizada</option>
              {ESTADOS_MP_FABRICA.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Button className="mt-3" size="sm" disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Guardar fábricas
      </Button>
    </section>
  );
}

function AllergensCard({
  materialId,
  formulation,
  contamination,
}: {
  materialId: string;
  formulation: string[];
  contamination: string[];
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState({ formulation, contamination });

  async function save() {
    setSaving(true);
    try {
      await setMaterialAllergens({ data: { materialId, ...value } });
      await queryClient.invalidateQueries();
      toast.success("Alergénios atualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel p-4">
      <h2 className="font-display mb-1 text-base font-semibold">Alergénios</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        14 alergénios do Regulamento (UE) 1169/2011. Indique se estão na formulação ou apenas por contaminação cruzada.
      </p>
      <AllergenPicker formulation={value.formulation} contamination={value.contamination} onChange={setValue} />
      <Button className="mt-3" size="sm" disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Guardar alergénios
      </Button>
    </section>
  );
}

function SuppliersCard({
  materialId,
  links,
  suppliers,
}: {
  materialId: string;
  links: {
    id: string;
    supplier_id: string;
    supplier_reference: string | null;
    origin_country: string | null;
    shelf_life_months: number | null;
    preferred: boolean;
    suppliers: { id: string; name: string; code: string | null; status: string } | null;
  }[];
  suppliers: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierId: "",
    reference: "",
    origin: "",
    shelfLife: "",
    preferred: false,
  });

  async function add() {
    if (!form.supplierId) {
      toast.error("Escolha o fornecedor.");
      return;
    }
    setSaving(true);
    try {
      await upsertMaterialSupplier({
        data: {
          materialId,
          supplierId: form.supplierId,
          supplier_reference: form.reference.trim() || null,
          origin_country: form.origin.trim() || null,
          shelf_life_months: form.shelfLife ? Number(form.shelfLife) : null,
          preferred: form.preferred,
        },
      });
      await queryClient.invalidateQueries();
      setForm({ supplierId: "", reference: "", origin: "", shelfLife: "", preferred: false });
      toast.success("Fornecedor associado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await removeMaterialSupplier({ data: { id } });
      await queryClient.invalidateQueries();
      toast.success("Fornecedor removido desta matéria-prima.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  }

  return (
    <section className="panel p-4">
      <h2 className="font-display mb-3 text-base font-semibold">Fornecedores</h2>
      {links.length > 1 ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-medium-soft px-2 py-1 text-xs font-medium text-medium-foreground">
          <AlertTriangle className="size-3.5" /> {links.length} fornecedores: confirmar equivalência de alergénios e
          especificações.
        </p>
      ) : null}
      {links.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Sem fornecedores associados.</p>
      ) : (
        <ul className="divide-y divide-border">
          {links.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  to="/fornecedor/$supplierId"
                  params={{ supplierId: link.supplier_id }}
                  className="text-sm font-semibold hover:underline"
                >
                  {link.suppliers?.name ?? "Fornecedor"}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {link.supplier_reference ? `Ref. ${link.supplier_reference}` : "sem referência"}
                  {link.origin_country ? ` · origem ${link.origin_country}` : ""}
                  {link.shelf_life_months ? ` · validade ${link.shelf_life_months} meses` : ""}
                </p>
              </div>
              {link.preferred ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Star className="size-3.5" /> Preferencial
                </span>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => void remove(link.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <select
          value={form.supplierId}
          onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Escolher fornecedor</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          value={form.reference}
          onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
          placeholder="Referência do fornecedor"
        />
        <Input
          value={form.origin}
          onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
          placeholder="País de origem"
        />
        <Input
          value={form.shelfLife}
          onChange={(e) => setForm((f) => ({ ...f, shelfLife: e.target.value.replace(/\D/g, "") }))}
          placeholder="Validade estipulada (meses)"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={form.preferred}
            onChange={(e) => setForm((f) => ({ ...f, preferred: e.target.checked }))}
          />
          Fornecedor preferencial
        </label>
        <Button size="sm" disabled={saving} onClick={() => void add()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Associar fornecedor
        </Button>
      </div>
    </section>
  );
}
