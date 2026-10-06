import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Globe2, Package } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { gateStatus } from "@/lib/gate.functions";
import { listSurveillance, setAlertClosed } from "@/lib/data.functions";

const survQuery = queryOptions({ queryKey: ["surveillance"], queryFn: () => listSurveillance() });

export const Route = createFileRoute("/vigilancia")({
  head: () => ({
    meta: [
      { title: "Vigilância RASFF semanal | Gestão de MP" },
      { name: "description", content: "Semanas RASFF carregadas desde a semana 38, alertas por origem e por matéria-prima, com fecho de cada alerta." },
      { property: "og:title", content: "Vigilância RASFF semanal" },
      { property: "og:description", content: "Acompanhar e fechar alertas RASFF por origem e matéria-prima." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(survQuery),
  component: SurveillancePage,
});

type Week = Awaited<ReturnType<typeof listSurveillance>>[number];
type Alert = Week["alerts"][number];

const LEVEL_TONE: Record<string, string> = {
  alto: "border-high/30 bg-high-soft text-high",
  medio: "border-medium/30 bg-medium-soft text-medium",
  médio: "border-medium/30 bg-medium-soft text-medium",
  baixo: "border-low/30 bg-low-soft text-low",
};

function SurveillancePage() {
  const { data: weeks } = useSuspenseQuery(survQuery);
  const [weekId, setWeekId] = useState<string>(weeks[0]?.id ?? "");
  const [view, setView] = useState<"origem" | "mp">("origem");
  const [showClosed, setShowClosed] = useState(true);
  const qc = useQueryClient();
  const toggle = useServerFn(setAlertClosed);
  const [busy, setBusy] = useState<string | null>(null);

  const week = weeks.find((w) => w.id === weekId);
  const alerts = (week?.alerts ?? []).filter((a) => showClosed || !a.closed);

  const groups = useMemo(() => {
    const m = new Map<string, Alert[]>();
    for (const a of alerts) {
      const keys =
        view === "origem"
          ? [a.origin_country?.trim() || "Origem não indicada"]
          : a.materials.length
            ? [...new Set(a.materials.map((x) => x.name))]
            : ["Sem MP afetada"];
      for (const k of keys) m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m.entries()].sort((x, y) => {
      if (x[0] === "Sem MP afetada") return 1;
      if (y[0] === "Sem MP afetada") return -1;
      return y[1].length - x[1].length;
    });
  }, [alerts, view]);

  async function onToggle(a: Alert) {
    setBusy(a.id);
    try {
      await toggle({ data: { alertId: a.id, closed: !a.closed } });
      await qc.invalidateQueries({ queryKey: ["surveillance"] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Vigilância RASFF" description="Semanas a partir da 38: alertas por origem e por matéria-prima.">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Vigilância RASFF</h1>
          <p className="text-sm text-muted-foreground">Semanas carregadas a partir da semana 38. Marque cada alerta como fechado depois de avaliado.</p>
        </div>

        {weeks.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda não há semanas a partir da 38 guardadas. Carregue o ficheiro em "Nova análise" e escolha as semanas.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {weeks.map((w) => {
                const closed = w.alerts.filter((a) => a.closed).length;
                const total = w.alerts.length;
                const pct = total ? Math.round((closed / total) * 100) : 0;
                return (
                  <button
                    key={w.id}
                    onClick={() => setWeekId(w.id)}
                    className={`rounded-lg border bg-card p-4 text-left transition ${w.id === weekId ? "border-primary ring-2 ring-primary/30" : ""}`}
                  >
                    <div className="font-semibold">Semana {w.week}/{w.year}</div>
                    <div className="text-sm text-muted-foreground">{closed} de {total} alertas fechados</div>
                    <div className="mt-2 h-2 rounded bg-muted">
                      <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setView("origem")} className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm ${view === "origem" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                <Globe2 className="h-4 w-4" /> Por origem
              </button>
              <button onClick={() => setView("mp")} className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm ${view === "mp" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                <Package className="h-4 w-4" /> Por matéria-prima
              </button>
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Mostrar fechados
              </label>
            </div>

            <div className="space-y-4">
              {groups.map(([key, list]) => (
                <section key={key} className="rounded-lg border bg-card">
                  <header className="flex items-center justify-between border-b px-4 py-2">
                    <h2 className="font-medium">{key}</h2>
                    <span className="text-xs text-muted-foreground">
                      {list.filter((a) => a.closed).length}/{list.length} fechados
                    </span>
                  </header>
                  <ul className="divide-y">
                    {list.map((a) => (
                      <li key={a.id} className={`flex items-start gap-3 px-4 py-3 ${a.closed ? "opacity-60" : ""}`}>
                        <button
                          disabled={busy === a.id}
                          onClick={() => onToggle(a)}
                          aria-label={a.closed ? "Reabrir alerta" : "Fechar alerta"}
                          className="mt-0.5 text-primary"
                        >
                          {a.closed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <div className="min-w-0 flex-1 text-sm">
                          <div className="font-medium">{a.product}</div>
                          <div className="text-muted-foreground">
                            {[a.reference, a.hazard, a.origin_country, a.notified_on].filter(Boolean).join(" · ")}
                          </div>
                          {a.materials.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {a.materials.map((m, i) => (
                                <span key={i} className={`rounded border px-1.5 py-0.5 text-xs ${LEVEL_TONE[m.level?.toLowerCase()] ?? "bg-muted"}`}>
                                  {m.name} · {m.level}
                                </span>
                              ))}
                            </div>
                          )}
                          {a.closed && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Fechado{a.closed_by ? ` por ${a.closed_by}` : ""}{a.closed_at ? ` em ${new Date(a.closed_at).toLocaleDateString("pt-PT")}` : ""}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {groups.length === 0 && <p className="text-sm text-muted-foreground">Sem alertas para mostrar.</p>}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
