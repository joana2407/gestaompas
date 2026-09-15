import { createFileRoute, redirect } from "@tanstack/react-router";
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
import { materialsQuery } from "@/lib/queries";
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
  loader: ({ context }) => context.queryClient.ensureQueryData(materialsQuery),
  component: Inventory,
});

function Inventory() {
  const { data: materials } = useSuspenseQuery(materialsQuery);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

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
      }
    >
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
            <MaterialCard key={material.id} material={material} />
          ))}
        </div>

      )}
    </AppShell>
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
};

function MaterialCard({ material }: { material: Material }) {
  const queryClient = useQueryClient();
  const ingredients = material.raw_material_ingredients ?? [];
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
          <h2 className="font-display text-base font-semibold">{material.name}</h2>
          <p className="text-xs text-muted-foreground">
            {material.code}
            {material.supplier ? ` · ${material.supplier}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {material.kind === "composta" ? "Composta" : "Simples"}
        </span>
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
          {ingredients.length > 0 ? ingredients.map((i) => i.name).join(", ") : "—"}{" "}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            editar
          </button>
        </p>
      )}

      {material.notes ? <p className="mt-2 text-xs text-muted-foreground">{material.notes}</p> : null}
    </article>
  );
}
