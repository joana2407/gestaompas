import { AllergenIcon } from "@/components/icons";
import { ALERGENIOS, ALERGENIOS_CRITICOS, alergenioAbrev, alergenioLabel } from "@/lib/domain";

/** Etiquetas compactas: formulação em destaque, contaminação em contorno tracejado. */
export function AllergenTags({
  formulation,
  contamination,
  empty = "Sem alergénios registados",
}: {
  formulation: string[] | null | undefined;
  contamination: string[] | null | undefined;
  empty?: string;
}) {
  const form = formulation ?? [];
  const cont = (contamination ?? []).filter((id) => !form.includes(id));
  if (form.length === 0 && cont.length === 0) {
    return <span className="text-xs text-muted-foreground">{empty}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {form.map((id) => (
        <span
          key={`f-${id}`}
          title={`${alergenioLabel(id)} — na formulação`}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
            ALERGENIOS_CRITICOS.includes(id as never)
              ? "border-high/30 bg-high-soft text-high"
              : "border-border bg-secondary text-foreground"
          }`}
        >
          <AllergenIcon id={id} className="size-3" />
          {alergenioAbrev(id)}
        </span>
      ))}
      {cont.map((id) => (
        <span
          key={`c-${id}`}
          title={`${alergenioLabel(id)} — contaminação cruzada`}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-medium/60 px-1.5 py-0.5 text-[11px] font-medium text-medium-foreground"
        >
          <AllergenIcon id={id} className="size-3" />
          {alergenioAbrev(id)}
        </span>
      ))}
    </div>
  );
}

/** Seletor com os 14 alergénios do Regulamento (UE) 1169/2011. */
export function AllergenPicker({
  formulation,
  contamination,
  onChange,
}: {
  formulation: string[];
  contamination: string[];
  onChange: (next: { formulation: string[]; contamination: string[] }) => void;
}) {
  function set(id: string, value: "ausente" | "formulacao" | "contaminacao") {
    onChange({
      formulation: value === "formulacao" ? [...new Set([...formulation, id])] : formulation.filter((a) => a !== id),
      contamination:
        value === "contaminacao" ? [...new Set([...contamination, id])] : contamination.filter((a) => a !== id),
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ALERGENIOS.map((allergen) => {
        const current = formulation.includes(allergen.id)
          ? "formulacao"
          : contamination.includes(allergen.id)
            ? "contaminacao"
            : "ausente";
        return (
          <div key={allergen.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
            <span className="flex items-center gap-2 text-sm">
              <AllergenIcon id={allergen.id} className="size-4 text-muted-foreground" />
              {allergen.label}
            </span>
            <select
              value={current}
              onChange={(event) => set(allergen.id, event.target.value as "ausente" | "formulacao" | "contaminacao")}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="ausente">Ausente</option>
              <option value="formulacao">Formulação</option>
              <option value="contaminacao">Contaminação</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}
