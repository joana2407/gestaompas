import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, FileSpreadsheet, Layers, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/AppShell";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { analysesQuery, findingsOverviewQuery, materialsQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vigilância RASFF — Risco de matérias-primas | BRC" },
      {
        name: "description",
        content:
          "Dashboard semanal que cruza alertas RASFF com o inventário de matérias-primas de panificação e classifica o risco por MP.",
      },
      { property: "og:title", content: "Vigilância RASFF — Risco de matérias-primas" },
      {
        property: "og:description",
        content: "Análise semanal de alertas RASFF cruzada com o inventário de MP, com relatórios guardados.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(analysesQuery),
      context.queryClient.ensureQueryData(findingsOverviewQuery),
      context.queryClient.ensureQueryData(materialsQuery),
    ]);
  },
  component: Dashboard,
});

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${tone ?? ""}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Dashboard() {
  const { data: analyses } = useSuspenseQuery(analysesQuery);
  const { data: findings } = useSuspenseQuery(findingsOverviewQuery);
  const { data: materials } = useSuspenseQuery(materialsQuery);

  const count = (level: string) => findings.filter((f) => f.risk_level === level).length;

  const chartData = [...analyses]
    .slice(0, 12)
    .reverse()
    .map((analysis) => {
      const own = findings.filter((f) => f.analysis_id === analysis.id);
      return {
        semana: analysis.week_label,
        Alto: own.filter((f) => f.risk_level === "ALTO").length,
        Médio: own.filter((f) => f.risk_level === "MEDIO").length,
        Baixo: own.filter((f) => f.risk_level === "BAIXO").length,
      };
    });

  return (
    <AppShell
      title="Vigilância RASFF"
      description="Cruzamento semanal dos alertas RASFF com o inventário de matérias-primas e classificação de risco para a equipa de qualidade."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/materias-primas">
              <FileSpreadsheet className="mr-2 size-4" /> Inventário
            </Link>
          </Button>
          <Button asChild>
            <Link to="/nova-analise">
              <Plus className="mr-2 size-4" /> Nova análise
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Análises guardadas" value={analyses.length} hint="Relatórios por semana" />
        <Kpi label="Risco alto" value={count("ALTO")} tone="text-high" hint="MP a confirmar com urgência" />
        <Kpi label="Risco médio" value={count("MEDIO")} tone="text-medium-foreground" />
        <Kpi label="MP no inventário" value={materials.length} hint={`${materials.filter((m) => m.kind === "composta").length} compostas`} />
      </div>

      {chartData.length > 0 ? (
        <section className="panel mt-6 p-5">
          <h2 className="text-base font-semibold">Evolução do risco por semana</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="Alto" stackId="r" fill="var(--color-high)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Médio" stackId="r" fill="var(--color-medium)" />
                <Bar dataKey="Baixo" stackId="r" fill="var(--color-low)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Relatórios semanais</h2>
        {analyses.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <Layers className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ainda não existem análises. Importe o inventário de matérias-primas e carregue a listagem RASFF da semana.
            </p>
            <Button asChild>
              <Link to="/nova-analise">Começar</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {analyses.map((analysis) => {
              const own = findings.filter((f) => f.analysis_id === analysis.id);
              const high = own.filter((f) => f.risk_level === "ALTO").length;
              return (
                <Link
                  key={analysis.id}
                  to="/analise/$analysisId"
                  params={{ analysisId: analysis.id }}
                  className="panel flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-40">
                    <p className="font-display font-semibold">{analysis.week_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(analysis.created_at).toLocaleDateString("pt-PT")} ·{" "}
                      {analysis.status === "fechado" ? "Fechado" : "Em revisão"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-secondary px-2 py-1">{analysis.total_alerts} alertas</span>
                    <span className="rounded-md bg-secondary px-2 py-1">{analysis.total_at_risk} MP em risco</span>
                    {high > 0 ? <RiskBadge level="ALTO" /> : null}
                  </div>
                  {high > 0 ? <AlertTriangle className="size-4 text-high" /> : null}
                  <ArrowRight className="ml-auto size-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
