import {
  Bean,
  Boxes,
  Carrot,
  Egg,
  Factory,
  Fish,
  FlaskConical,
  Leaf,
  Milk,
  Nut,
  Shell,
  Shrimp,
  Slice,
  Sprout,
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
  mostarda: Leaf,
  sesamo: Sprout,
  sulfitos: FlaskConical,
  tremoco: Bean,
  moluscos: Shell,
};

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

export function FactoryIcon({ code, className = "size-4" }: { code: string | null | undefined; className?: string }) {
  const Icon = factoryIcon(code);
  return <Icon className={className} />;
}
