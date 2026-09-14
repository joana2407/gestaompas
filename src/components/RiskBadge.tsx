import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  ALTO: "Risco alto",
  MEDIO: "Risco médio",
  BAIXO: "Risco baixo",
};

const STYLES: Record<string, string> = {
  ALTO: "bg-high-soft text-high border-high/30",
  MEDIO: "bg-medium-soft text-medium-foreground border-medium/40",
  BAIXO: "bg-low-soft text-low border-low/30",
};

export function RiskBadge({ level, className }: { level: string; className?: string }) {
  const key = level?.toUpperCase() ?? "MEDIO";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        STYLES[key] ?? STYLES["MEDIO"],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {LABELS[key] ?? key}
    </span>
  );
}
