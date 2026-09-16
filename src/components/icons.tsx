import {
  Bean,
  Boxes,
  Carrot,
  Egg,
  Factory,
  Fish,
  FlaskConical,
  Flower2,
  Leaf,
  Milk,
  Nut,
  Popcorn,
  Shell,
  Shrimp,
  Slice,
  Sprout,
  Vegan,
  Wheat,
  WheatOff,
  type LucideIcon,
} from "lucide-react";

import { alergenioLabel } from "@/lib/domain";

/** Ícone por alergénio (Regulamento UE 1169/2011). */
export const ALERGENIO_ICON: Record<string, LucideIcon> = {
  gluten: Wheat,
  crustaceos: Shrimp,
  ovos: Egg,
  peixe: Fish,
  amendoins: Bean,
  soja: Sprout,
  leite: Milk,
  frutos_casca_rija: Nut,
  aipo: Carrot,
  mostarda: Flower2,
  sesamo: Popcorn,
  sulfitos: FlaskConical,
  tremoco: Vegan,
  moluscos: Shell,
};

/** Famílias de alergénios com cor própria, para leitura rápida. */
export type Tone = "cereal" | "mar" | "noz" | "lacteo" | "vegetal" | "quimico";

export const ALERGENIO_TONE: Record<string, Tone> = {
  gluten: "cereal",
  crustaceos: "mar",
  peixe: "mar",
  moluscos: "mar",
  amendoins: "noz",
  frutos_casca_rija: "noz",
  sesamo: "noz",
  tremoco: "noz",
  ovos: "lacteo",
  leite: "lacteo",
  soja: "vegetal",
  aipo: "vegetal",
  mostarda: "vegetal",
  sulfitos: "quimico",
};

export const TONE_TEXT: Record<Tone | "fab1" | "fab2" | "fab3" | "neutro", string> = {
  cereal: "text-tone-cereal",
  mar: "text-tone-mar",
  noz: "text-tone-noz",
  lacteo: "text-tone-lacteo",
  vegetal: "text-tone-vegetal",
  quimico: "text-tone-quimico",
  fab1: "text-tone-fab1",
  fab2: "text-tone-fab2",
  fab3: "text-tone-fab3",
  neutro: "text-muted-foreground",
};

export const TONE_CHIP: Record<Tone | "fab1" | "fab2" | "fab3" | "neutro", string> = {
  cereal: "border-tone-cereal/35 bg-tone-cereal-soft text-tone-cereal",
  mar: "border-tone-mar/35 bg-tone-mar-soft text-tone-mar",
  noz: "border-tone-noz/35 bg-tone-noz-soft text-tone-noz",
  lacteo: "border-tone-lacteo/35 bg-tone-lacteo-soft text-tone-lacteo",
  vegetal: "border-tone-vegetal/35 bg-tone-vegetal-soft text-tone-vegetal",
  quimico: "border-tone-quimico/35 bg-tone-quimico-soft text-tone-quimico",
  fab1: "border-tone-fab1/35 bg-tone-fab1-soft text-tone-fab1",
  fab2: "border-tone-fab2/35 bg-tone-fab2-soft text-tone-fab2",
  fab3: "border-tone-fab3/35 bg-tone-fab3-soft text-tone-fab3",
  neutro: "border-border bg-secondary text-muted-foreground",
};

export function allergenTone(id: string): Tone | "neutro" {
  return ALERGENIO_TONE[id] ?? "neutro";
}

export function AllergenIcon({ id, className = "size-3.5" }: { id: string; className?: string }) {
  const Icon = ALERGENIO_ICON[id] ?? Leaf;
  return <Icon className={className} aria-label={alergenioLabel(id)} />;
}

/** Ícone por unidade fabril: fatiados, granel e sem glúten. */
export function factoryIcon(code: string | null | undefined): LucideIcon {
  const value = (code ?? "").toUpperCase();
  if (value.includes("1")) return Slice;
  if (value.includes("2")) return Boxes;
  if (value.includes("3") || value.includes("SG")) return WheatOff;
  return Factory;
}

export function factoryTone(code: string | null | undefined): "fab1" | "fab2" | "fab3" | "neutro" {
  const value = (code ?? "").toUpperCase();
  if (value.includes("1")) return "fab1";
  if (value.includes("2")) return "fab2";
  if (value.includes("3") || value.includes("SG")) return "fab3";
  return "neutro";
}

export function FactoryIcon({ code, className = "size-4" }: { code: string | null | undefined; className?: string }) {
  const Icon = factoryIcon(code);
  return <Icon className={className} />;
}

/** Etiqueta compacta e colorida de uma unidade fabril. */
export function FactoryChip({
  code,
  name,
  className = "",
}: {
  code: string | null | undefined;
  name?: string | null;
  className?: string;
}) {
  const tone = factoryTone(code);
  return (
    <span
      title={name ?? code ?? undefined}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CHIP[tone]} ${className}`}
    >
      <FactoryIcon code={code} className="size-3.5" />
      {name ?? code}
    </span>
  );
}
