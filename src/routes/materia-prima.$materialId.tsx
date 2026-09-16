import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Star, Trash2 } from "lucide-react";

import { AllergenPicker, AllergenTags } from "@/components/AllergenTags";
import { FactoryIcon } from "@/components/icons";
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
          kind={material.kind}
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

function BasicsCard({
  material,
}: {
  material: {
    id: string;
    name: string;
    code: string | null;
    category: string | null;
    kind: string;
    origins: string[];
    notes: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState({
    name: material.name,
    code: material.code ?? "",
    category: material.category ?? "",
    origins: material.origins.join(", "),
    notes: material.notes ?? "",
  });

  async function save() {
    if (!form.name.trim()) {
      toast.error("Indique o nome da matéria-prima.");
      return;
    }
    const origins = form.origins
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (material.kind === "composta" && origins.length === 0) {
      toast.error("Nas matérias-primas compostas é obrigatório indicar a origem da própria matéria-prima.");
      return;
    }
    setSaving(true);
    try {
      await updateMaterialBasics({
        data: {
          materialId: material.id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          category: form.category.trim() || null,
          origins,
          notes: form.notes.trim() || null,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Matéria-prima atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Eliminar "${material.name}"? São também eliminados os fornecedores associados e a documentação desta matéria-prima.`,
      )
    )
      return;
    setRemoving(true);
    try {
      await deleteMaterial({ data: { materialId: material.id } });
      await queryClient.invalidateQueries();
      toast.success("Matéria-prima eliminada.");
      void navigate({ to: "/materias-primas" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível eliminar.");
      setRemoving(false);
    }
  }

  return (
    <section className="panel p-4">
      <h2 className="font-display mb-3 text-base font-semibold">Dados da matéria-prima</h2>
      <div className="grid gap-2 md:grid-cols-2">
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome" />
        <Input
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          placeholder="Código / referência"
        />
        <Input
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          placeholder="Categoria"
        />
        <Input
          value={form.origins}
          onChange={(e) => setForm((f) => ({ ...f, origins: e.target.value }))}
          placeholder={
            material.kind === "composta"
              ? "Origem da MP (obrigatória) — separada por vírgula"
              : "Origens separadas por vírgula"
          }
        />
      </div>
      {material.kind === "composta" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Matéria-prima composta: indique a origem desta matéria-prima e, no quadro ao lado, a origem de cada
          ingrediente.
        </p>
      ) : null}
      <Textarea
        className="mt-2"
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        placeholder="Observações"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Guardar dados
        </Button>
        <Button size="sm" variant="ghost" disabled={removing} onClick={() => void remove()}>
          <Trash2 className="mr-2 size-4" /> Eliminar matéria-prima
        </Button>
      </div>
    </section>
  );
}

function IngredientsCard({
  materialId,
  kind,
  ingredients,
  allergens,
}: {
  materialId: string;
  kind: string;
  ingredients: { id: string; name: string; origin: string | null }[];
  allergens: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(ingredients.map((i) => ({ name: i.name, origin: i.origin ?? "" })));
  const composta = kind === "composta";
  const missingOrigins = composta ? rows.filter((r) => r.name.trim() && !r.origin.trim()).map((r) => r.name.trim()) : [];

  async function save() {
    const clean = rows.filter((r) => r.name.trim());
    if (composta && clean.some((r) => !r.origin.trim())) {
      toast.error("Nas matérias-primas compostas indique a origem de cada ingrediente.");
      return;
    }
    setSaving(true);
    try {
      await setMaterialIngredients({
        data: {
          materialId,
          ingredients: clean.map((r) => ({ name: r.name.trim(), origin: r.origin.trim() || null })),
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Ingredientes atualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel p-4">
      <h2 className="font-display mb-1 text-base font-semibold">Ingredientes e origens</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Indique a origem de cada ingrediente para a rastreabilidade das MP compostas.
      </p>
      <div className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Sem ingredientes registados.</p> : null}
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={row.name}
              onChange={(e) =>
                setRows((rs) => rs.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))
              }
              placeholder="Ingrediente"
            />
            <Input
              value={row.origin}
              onChange={(e) =>
                setRows((rs) => rs.map((r, i) => (i === index ? { ...r, origin: e.target.value } : r)))
              }
              placeholder="Origem"
            />
            <Button size="sm" variant="ghost" onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setRows((rs) => [...rs, { name: "", origin: "" }])}>
          Adicionar ingrediente
        </Button>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Guardar ingredientes
        </Button>
      </div>
      <div className="mt-3">{allergens}</div>
    </section>
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
            <span className="flex items-center gap-2 text-sm">
              <FactoryIcon code={factory.code} className="size-4 text-muted-foreground" />
              {factory.name}
            </span>
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
            <SupplierLinkRow key={link.id} materialId={materialId} link={link} onRemove={() => void remove(link.id)} />
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

type SupplierLink = {
  id: string;
  supplier_id: string;
  supplier_reference: string | null;
  origin_country: string | null;
  shelf_life_months: number | null;
  preferred: boolean;
  active?: boolean;
  suppliers: { id: string; name: string; code: string | null; status: string } | null;
};

function SupplierLinkRow({
  materialId,
  link,
  onRemove,
}: {
  materialId: string;
  link: SupplierLink;
  onRemove: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    reference: link.supplier_reference ?? "",
    origin: link.origin_country ?? "",
    shelfLife: link.shelf_life_months ? String(link.shelf_life_months) : "",
    preferred: link.preferred,
    active: link.active ?? true,
  });

  async function save() {
    setSaving(true);
    try {
      await updateMaterialSupplierLink({
        data: {
          id: link.id,
          materialId,
          supplier_reference: form.reference.trim() || null,
          origin_country: form.origin.trim() || null,
          shelf_life_months: form.shelfLife ? Number(form.shelfLife) : null,
          preferred: form.preferred,
          active: form.active,
        },
      });
      await queryClient.invalidateQueries();
      setEditing(false);
      toast.success("Fornecedor atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
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
            {link.active === false ? " · inativo" : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            link.preferred ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Star className="size-3.5" /> {link.preferred ? "Preferencial" : "Secundário"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? "Fechar" : "Editar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {editing ? (
        <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3">
          <div className="grid gap-2 md:grid-cols-3">
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
              placeholder="Validade (meses)"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.preferred}
                onChange={(e) => setForm((f) => ({ ...f, preferred: e.target.checked }))}
              />
              Fornecedor preferencial
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Ativo
            </label>
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
