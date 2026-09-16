import { AllergenIcon, TONE_CHIP, TONE_TEXT, allergenTone } from "@/components/icons";
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
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CHIP[allergenTone(id)]} ${
            ALERGENIOS_CRITICOS.includes(id as never) ? "ring-1 ring-high/50" : ""
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
          className={`inline-flex items-center gap-1 rounded-md border border-dashed bg-background px-1.5 py-0.5 text-[11px] font-medium ${TONE_CHIP[allergenTone(id)]} bg-transparent`}
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
          <div
            key={allergen.id}
            className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
              current === "formulacao"
                ? TONE_CHIP[allergenTone(allergen.id)]
                : current === "contaminacao"
                  ? "border-dashed border-medium/60 bg-medium-soft/50"
                  : "border-border"
            }`}
          >
            <span className="flex items-center gap-2 text-sm">
              <AllergenIcon id={allergen.id} className={`size-4 ${TONE_TEXT[allergenTone(allergen.id)]}`} />
              {allergen.label}
            </span>
            <select
              value={current}
              onChange={(event) => set(allergen.id, event.target.value as "ausente" | "formulacao" | "contaminacao")}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium"
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
