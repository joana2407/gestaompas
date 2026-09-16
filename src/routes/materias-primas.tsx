import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { gateStatus } from "@/lib/gate.functions";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search, Upload } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createMaterial, replaceInventory, setIngredients } from "@/lib/data.functions";
import { catalogQuery } from "@/lib/queries";
import { AllergenTags } from "@/components/AllergenTags";
import { parseInventoryWorkbook } from "@/lib/inventory-import";

export const Route = createFileRoute("/materias-primas")({
  head: () => ({
    meta: [
      { title: "Inventário de matérias-primas | Vigilância RASFF" },
      {
        name: "description",
        content:
          "Importe o ficheiro de avaliação de riscos de MP e ME: cada aba é uma matéria-prima, com origens e ingredientes componentes.",
      },
      { property: "og:title", content: "Inventário de matérias-primas" },
      { property: "og:description", content: "Importação e consulta das MP, origens e ingredientes componentes." },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Inventory,
});

function Inventory() {
  const { data: catalog } = useSuspenseQuery(catalogQuery);
  const materials = catalog.materials;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const parsed = await parseInventoryWorkbook(file);
      if (parsed.length === 0) throw new Error("Não foi possível encontrar matérias-primas nas abas deste ficheiro.");

      await replaceInventory({ data: { materials: parsed } });

      await queryClient.invalidateQueries();
      toast.success(`${parsed.length} matérias-primas importadas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ler o ficheiro.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = materials.filter((m) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      m.name.toLowerCase().includes(term) ||
      (m.code ?? "").toLowerCase().includes(term) ||
      m.origins.join(" ").toLowerCase().includes(term) ||
      (m.raw_material_ingredients ?? []).some((i) => i.name.toLowerCase().includes(term))
    );
  });

  return (
    <AppShell
      title="Inventário de matérias-primas"
      description="Cada aba do ficheiro de avaliação de riscos corresponde a uma matéria-prima. A importação substitui o inventário anterior."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="mr-2 size-4" />
            Nova matéria-prima
          </Button>
          <label className="inline-flex">
            <Button asChild disabled={busy}>
              <span>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                Importar Excel
              </span>
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleFile(file);
              }}
            />
          </label>
        </div>
      }
    >
      {adding ? <NewMaterialForm onClose={() => setAdding(false)} /> : null}

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Procurar MP, origem ou ingrediente"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          Sem matérias-primas. Importe o ficheiro Excel de avaliação de riscos de MP e ME.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              factories={catalog.materialFactories
                .filter((mf) => mf.raw_material_id === material.id && mf.state !== "inativa")
                .map((mf) => catalog.factories.find((f) => f.id === mf.factory_id)?.code ?? "")
                .filter(Boolean)}
              supplierCount={catalog.materialSuppliers.filter((ms) => ms.raw_material_id === material.id).length}
            />
          ))}
        </div>

      )}
    </AppShell>
  );
}

function NewMaterialForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [origins, setOrigins] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    if (!name.trim()) {
      toast.error("Indique o nome da matéria-prima.");
      return;
    }
    setSaving(true);
    try {
      const list = (value: string) =>
        value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      const parsedIngredients = list(ingredients).map((entry) => {
        const match = entry.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
        return {
          name: (match?.[1] ?? entry).trim(),
          origin: match?.[2]?.trim() || null,
        };
      });
      const kind = parsedIngredients.length > 1 ? "composta" : "simples";
      const originList = list(origins);
      if (kind === "composta" && originList.length === 0) {
        toast.error("Nas matérias-primas compostas indique a origem da própria matéria-prima.");
        return;
      }
      if (kind === "composta" && parsedIngredients.some((i) => !i.origin)) {
        toast.error("Indique a origem de cada ingrediente, por exemplo: Farinha (Portugal), Açúcar (Brasil).");
        return;
      }
      await createMaterial({
        data: {
          name: name.trim(),
          code: code.trim() || null,
          category: category.trim() || null,
          kind,
          origins: originList,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
          ingredients: parsedIngredients,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Matéria-prima adicionada.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel mb-4 p-4">
      <h2 className="font-display mb-3 text-base font-semibold">Nova matéria-prima</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da MP (obrigatório)" />
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código / referência" />
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria" />
        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Fornecedor" />
        <Input
          value={origins}
          onChange={(e) => setOrigins(e.target.value)}
          placeholder="Origens separadas por vírgula (ex.: Portugal, Espanha)"
        />
        <Input
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="Ingredientes com origem: Farinha (Portugal), Açúcar (Brasil)"
        />
      </div>
      <Textarea
        className="mt-3"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Observações"
      />
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

type Material = {
  id: string;
  code: string | null;
  name: string;
  kind: string;
  origins: string[];
  supplier: string | null;
  notes: string | null;
  raw_material_ingredients: { id: string; name: string; origin: string | null }[] | null;
  allergens_formulation: string[] | null;
  allergens_contamination: string[] | null;
};

function MaterialCard({
  material,
  factories,
  supplierCount,
}: {
  material: Material;
  factories: string[];
  supplierCount: number;
}) {
  const queryClient = useQueryClient();
  const ingredients = material.raw_material_ingredients ?? [];
  const missingIngredientOrigin = ingredients.some((i) => !i.origin);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(ingredients.map((i) => i.name).join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const names = value
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      await setIngredients({ data: { materialId: material.id, names, fallbackKind: material.kind } });
      await queryClient.invalidateQueries();
      setEditing(false);
      toast.success("Ingredientes atualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">
            <Link to="/materia-prima/$materialId" params={{ materialId: material.id }} className="hover:underline">
              {material.name}
            </Link>
          </h2>
          <p className="text-xs text-muted-foreground">
            {material.code}
            {material.supplier ? ` · ${material.supplier}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {material.kind === "composta" ? "Composta" : "Simples"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {factories.length > 0 ? (
          <span className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-semibold">
            {factories.join(" · ")}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Sem fábrica atribuída</span>
        )}
        <span className={`text-[11px] ${supplierCount > 1 ? "font-semibold text-medium-foreground" : "text-muted-foreground"}`}>
          {supplierCount} fornecedor(es)
        </span>
        <AllergenTags
          formulation={material.allergens_formulation}
          contamination={material.allergens_contamination}
          empty="Alergénios não registados"
        />
      </div>

      {material.origins.length > 0 ? (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Origens: </span>
          {material.origins.join(", ")}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-3">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ingredientes separados por vírgula"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Ingredientes: </span>
          {ingredients.length > 0
            ? ingredients.map((i) => (i.origin ? `${i.name} (${i.origin})` : i.name)).join(", ")
            : "—"}{" "}
          {material.kind === "composta" ? (
            <Link
              to="/materia-prima/$materialId"
              params={{ materialId: material.id }}
              className="ml-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              editar origens
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              editar
            </button>
          )}
        </p>
      )}
      {material.kind === "composta" && missingIngredientOrigin ? (
        <p className="mt-2 rounded-lg border border-high/30 bg-high-soft p-2 text-[11px] text-high">
          Falta a origem de alguns ingredientes desta matéria-prima composta.
        </p>
      ) : null}
      {material.kind === "composta" && material.origins.length === 0 ? (
        <p className="mt-2 rounded-lg border border-high/30 bg-high-soft p-2 text-[11px] text-high">
          Falta a origem da própria matéria-prima composta.
        </p>
      ) : null}

      {material.notes ? <p className="mt-2 text-xs text-muted-foreground">{material.notes}</p> : null}
    </article>
  );
}
