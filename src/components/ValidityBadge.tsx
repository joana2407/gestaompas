import { VALIDITY_LABEL, validityState, type ValidityState } from "@/lib/domain";

const TONE: Record<ValidityState, string> = {
  sem_validade: "border-border bg-secondary text-muted-foreground",
  valido: "border-low/30 bg-low-soft text-low",
  expira_60: "border-medium/40 bg-medium-soft text-medium-foreground",
  expira_30: "border-medium/60 bg-medium-soft text-medium-foreground",
  expirado: "border-high/30 bg-high-soft text-high",
};

export function ValidityBadge({ expiresOn }: { expiresOn: string | null | undefined }) {
  const state = validityState(expiresOn);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[state]}`}>
      {VALIDITY_LABEL[state]}
    </span>
  );
}
