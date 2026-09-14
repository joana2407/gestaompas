import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Upload } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
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

      await supabase.from("raw_materials").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const { data: inserted, error } = await supabase
        .from("raw_materials")
        .insert(
          parsed.map((m) => ({
            code: m.code,
            name: m.name,
            category: m.category,
            kind: m.kind,
            origins: m.origins,
            supplier: m.supplier,
            notes: m.notes,
          })),
        )
        .select("id, name");
      if (error) throw new Error(error.message);

      const ingredientRows = parsed.flatMap((m, index) =>
        m.ingredients.map((i) => ({
          raw_material_id: inserted?.[index]?.id,
          name: i.name,
          origin: i.origin,
        })),
      );
      if (ingredientRows.length > 0) {
        const { error: ingredientError } = await supabase.from("raw_material_ingredients").insert(ingredientRows);
        if (ingredientError) throw new Error(ingredientError.message);
      }

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
            <article key={material.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">{material.name}</h2>
                  <p className="text-xs text-muted-foreground">{material.code}</p>
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
              {(material.raw_material_ingredients ?? []).length > 0 ? (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Ingredientes: </span>
                  {(material.raw_material_ingredients ?? []).map((i) => i.name).join(", ")}
                </p>
              ) : null}
              {material.notes ? <p className="mt-2 text-xs text-muted-foreground">{material.notes}</p> : null}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
