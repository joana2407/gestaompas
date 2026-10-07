import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { gateStatus } from "@/lib/gate.functions";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileCheck2,
  FileSpreadsheet,
  Layers,
  Package,
  ShieldAlert,
  Search,
  Users,
} from "lucide-react";
import type { ElementType } from "react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/AppShell";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analysesQuery, catalogQuery, documentsQuery, findingsOverviewQuery, materialsQuery } from "@/lib/queries";
import { ALERGENIOS_CRITICOS, validityState } from "@/lib/domain";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Análise semanal de alertas RASFF cruzada com o inventário de MP, com relatórios guardados.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(analysesQuery),
      context.queryClient.ensureQueryData(findingsOverviewQuery),
      context.queryClient.ensureQueryData(materialsQuery),
      context.queryClient.ensureQueryData(catalogQuery),
      context.queryClient.ensureQueryData(documentsQuery),
    ]);
  },
  component: Dashboard,
});

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon?: ElementType;
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="card-elegant p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className={`mt-1.5 font-display text-3xl font-bold ${tone ?? ""}`}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: analyses } = useSuspenseQuery(analysesQuery);
  const { data: findings } = useSuspenseQuery(findingsOverviewQuery);
  const { data: materials } = useSuspenseQuery(materialsQuery);
  const { data: catalog } = useSuspenseQuery(catalogQuery);
  const { data: docs } = useSuspenseQuery(documentsQuery);
  const [reportSearch, setReportSearch] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibleAnalyses = analyses.filter((analysis) => normalize([
    analysis.week_label, analysis.summary, analysis.source_filename,
    ...findings.filter((f) => f.analysis_id === analysis.id).map((f) => f.raw_material_name),
  ].filter(Boolean).join(" ")).includes(normalize(reportSearch.trim())));

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

  const active = docs.documents.filter((d) => !d.archived);
  const expired = active.filter((d) => validityState(d.expires_on) === "expirado").length;
  const expiring = active.filter((d) => ["expira_30", "expira_60"].includes(validityState(d.expires_on))).length;
  const noFactory = catalog.materials.filter(
    (m) => !catalog.materialFactories.some((mf) => mf.raw_material_id === m.id && mf.state !== "inativa"),
  ).length;
  const multiSupplier = catalog.materials.filter(
    (m) => catalog.materialSuppliers.filter((ms) => ms.raw_material_id === m.id).length > 1,
  ).length;
  const noAllergens = catalog.materials.filter(
    (m) => (m.allergens_formulation ?? []).length === 0 && (m.allergens_contamination ?? []).length === 0,
  ).length;
  const criticalAllergens = catalog.materials.filter((m) =>
    (m.allergens_formulation ?? []).some((a) => ALERGENIOS_CRITICOS.includes(a as never)),
  ).length;
  const pendingSuppliers = catalog.suppliers.filter((s) => s.status !== "completo").length;

  return (
    <AppShell
      title="Gestão de matérias-primas e fornecedores"
      description="Matérias-primas por fábrica, fornecedores, alergénios e documentação, mais a vigilância semanal de alertas RASFF."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/materias-primas">
              <FileSpreadsheet className="size-4" /> <span className="hidden sm:inline">Inventário</span>
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Package} label="Matérias-primas" value={materials.length} hint={`${materials.filter((m) => m.kind === "composta").length} compostas`} />
        <Kpi icon={Users} label="Fornecedores" value={catalog.suppliers.length} hint={`${pendingSuppliers} com documentação pendente`} />
        <Kpi icon={Building2} label="Unidades fabris" value={catalog.factories.length} hint={`${noFactory} MP sem fábrica`} />
        <Kpi icon={FileCheck2} label="Documentos" value={active.length} hint={`${expired} expirados · ${expiring} a expirar`} />
      </div>

      <section className="card-elegant mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Conformidade Documental</h2>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/documentos">Documentação</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/fornecedores">Fornecedores</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi icon={ShieldAlert} label="Documentos expirados" value={expired} tone={expired > 0 ? "text-high" : ""} hint="Renovar antes da auditoria" />
          <Kpi icon={FileCheck2} label="A expirar em 60 dias" value={expiring} tone={expiring > 0 ? "text-medium-foreground" : ""} />
          <Kpi icon={Users} label="Fornecedores com documentação pendente" value={pendingSuppliers} />
          <Kpi icon={Building2} label="MP sem fábrica atribuída" value={noFactory} hint="Definir onde é utilizada" />
          <Kpi icon={Users} label="MP com vários fornecedores" value={multiSupplier} hint="Confirmar equivalência de especificações" />
          <Kpi
            icon={AlertTriangle}
            label="MP sem alergénios registados"
            value={noAllergens}
            tone={noAllergens > 0 ? "text-medium-foreground" : ""}
            hint={`${criticalAllergens} MP com alergénio crítico declarado`}
          />
        </div>
      </section>

      {chartData.length > 0 ? (
        <section className="card-elegant mt-6 p-5">
          <h2 className="text-base font-semibold">Evolução do risco das Matérias-Primas por Semana</h2>
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
                <Bar dataKey="Alto" barSize={44} stackId="r" fill="var(--color-high)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Médio" barSize={44} stackId="r" fill="var(--color-medium)" />
                <Bar dataKey="Baixo" barSize={44} stackId="r" fill="var(--color-low)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">RASFF: Relatórios Semanais</h2>
        <div className="relative mb-4 max-w-lg">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input aria-label="Pesquisar relatórios semanais" placeholder="Pesquisar semana, matéria-prima ou sumário…" value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} className="pl-9" />
        </div>
        {analyses.length === 0 ? (
            <div className="card-elegant flex flex-col items-center gap-3 p-10 text-center">
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
            {visibleAnalyses.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum relatório corresponde à pesquisa.</p> : null}
            {visibleAnalyses.map((analysis) => {
              const own = findings.filter((f) => f.analysis_id === analysis.id);
              const high = own.filter((f) => f.risk_level === "ALTO").length;
              return (
                <Link
                  key={analysis.id}
                  to="/analise/$analysisId"
                  params={{ analysisId: analysis.id }}
                  className="card-elegant flex flex-wrap items-center gap-4 p-4 hover:border-primary/40"
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
