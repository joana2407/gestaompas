import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Download, Lock, Unlock } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setAnalysisStatus, updateFinding as updateFindingFn } from "@/lib/data.functions";
import { analysisDetailQuery } from "@/lib/queries";

export const Route = createFileRoute("/analise/$analysisId")({
  head: () => ({
    meta: [
      { title: "Relatório semanal de risco RASFF | Vigilância RASFF" },
      {
        name: "description",
        content:
          "Relatório de risco: alertas RASFF da semana, matérias-primas afetadas, razão do risco, rastreabilidade e ações recomendadas.",
      },
      { property: "og:title", content: "Relatório semanal de risco RASFF" },
      { property: "og:description", content: "MP afetadas, nível de risco, rastreabilidade e recomendações de ação." },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(analysisDetailQuery(params.analysisId));
    if (!data.analysis) throw notFound();
  },
  component: Report,
});

const LEVEL_ORDER = ["ALTO", "MEDIO", "BAIXO"];

function Report() {
  const { analysisId } = Route.useParams();
  const { data } = useSuspenseQuery(analysisDetailQuery(analysisId));
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const analysis = data.analysis!;
  const alertById = new Map(data.alerts.map((alert) => [alert.id, alert]));
  const findings = [...data.findings].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.risk_level) - LEVEL_ORDER.indexOf(b.risk_level),
  );

  async function updateFinding(
    id: string,
    patch: { risk_level?: "ALTO" | "MEDIO" | "BAIXO"; reviewed?: boolean; review_note?: string | null },
  ) {
    setSavingId(id);
    try {
      await updateFindingFn({ data: { id, ...patch } });
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleStatus() {
    const next = analysis.status === "fechado" ? "rascunho" : "fechado";
    try {
      await setAnalysisStatus({ data: { id: analysis.id, status: next } });
      await queryClient.invalidateQueries();
      toast.success(next === "fechado" ? "Relatório fechado." : "Relatório reaberto para revisão.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    }
  }

  function exportReport() {
    const lines: string[] = [
      `RELATÓRIO DE VIGILÂNCIA RASFF — ${analysis.week_label}`,
      `Data: ${new Date(analysis.created_at).toLocaleString("pt-PT")}`,
      `Ficheiro de origem: ${analysis.source_filename ?? "—"}`,
      "",
      "SUMÁRIO EXECUTIVO",
      `Alertas analisados: ${data.alerts.length}`,
      `MP em risco: ${analysis.total_at_risk}`,
      analysis.summary ?? "",
      "",
      "MATÉRIAS-PRIMAS EM RISCO",
    ];
    for (const finding of findings) {
      const alert = finding.alert_id ? alertById.get(finding.alert_id) : null;
      lines.push(
        "",
        `[${finding.risk_level}] ${finding.raw_material_name}${finding.ingredient_name ? ` (ingrediente: ${finding.ingredient_name})` : ""}`,
        `Alerta: ${alert ? `${alert.reference ?? "s/ref"} — ${alert.product}` : "—"}`,
        `Perigo: ${alert?.hazard ?? "—"} (${alert?.hazard_type ?? "—"})`,
        `Origem do alerta: ${alert?.origin_country ?? "—"} | Fabricante: ${alert?.manufacturer ?? "—"}`,
        `Tipo de risco: ${finding.risk_type ?? "—"}`,
        `Razão: ${finding.reason ?? "—"}`,
        `Rastreabilidade: ${finding.traceability ?? "—"}`,
        `Ação recomendada: ${finding.recommendation ?? "—"}`,
        `Revisto: ${finding.reviewed ? "sim" : "não"}${finding.review_note ? ` — ${finding.review_note}` : ""}`,
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-rasff-${analysis.week_label.replace(/[^\w]+/g, "-").toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = LEVEL_ORDER.map((level) => ({
    level,
    total: findings.filter((f) => f.risk_level === level).length,
  }));

  return (
    <AppShell
      title={`Relatório · ${analysis.week_label}`}
      description={`${data.alerts.length} alertas analisados · ${analysis.total_at_risk} matérias-primas em risco · ${analysis.status === "fechado" ? "relatório fechado" : "em revisão"}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 size-4" /> Voltar
            </Link>
          </Button>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 size-4" /> Exportar
          </Button>
          <Button onClick={toggleStatus}>
            {analysis.status === "fechado" ? <Unlock className="mr-2 size-4" /> : <Lock className="mr-2 size-4" />}
            {analysis.status === "fechado" ? "Reabrir" : "Fechar relatório"}
          </Button>
        </div>
      }
    >
      <section className="panel p-5">
        <h2 className="text-base font-semibold">Sumário executivo</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map((item) => (
            <span key={item.level} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm">
              <RiskBadge level={item.level} /> {item.total}
            </span>
          ))}
        </div>
        {analysis.summary ? <p className="mt-4 text-sm leading-relaxed">{analysis.summary}</p> : null}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Matérias-primas em risco</h2>
        {findings.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Nenhuma matéria-prima foi identificada em risco nos alertas desta semana.
          </div>
        ) : (
          <div className="grid gap-3">
            {findings.map((finding) => {
              const alert = finding.alert_id ? alertById.get(finding.alert_id) : null;
              return (
                <article key={finding.id} className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold">{finding.raw_material_name}</h3>
                      <p className="text-xs text-muted-foreground">
                        MP {finding.raw_material_kind ?? "—"}
                        {finding.ingredient_name ? ` · risco no ingrediente: ${finding.ingredient_name}` : " · risco na própria MP"}
                        {finding.risk_type ? ` · risco ${finding.risk_type}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={finding.risk_level}
                        onChange={(event) =>
                          void updateFinding(finding.id, {
                            risk_level: event.target.value as "ALTO" | "MEDIO" | "BAIXO",
                          })
                        }
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        aria-label="Nível de risco"
                      >
                        <option value="ALTO">Risco alto</option>
                        <option value="MEDIO">Risco médio</option>
                        <option value="BAIXO">Risco baixo</option>
                      </select>

                      <Button
                        size="sm"
                        variant={finding.reviewed ? "default" : "outline"}
                        disabled={savingId === finding.id}
                        onClick={() => void updateFinding(finding.id, { reviewed: !finding.reviewed })}
                      >
                        <CheckCircle2 className="mr-1.5 size-4" />
                        {finding.reviewed ? "Revisto" : "Marcar revisto"}
                      </Button>
                    </div>
                  </div>

                  {alert ? (
                    <div className="mt-4 rounded-lg bg-secondary/60 p-3 text-sm">
                      <p className="font-medium">
                        {alert.reference ? `${alert.reference} · ` : ""}
                        {alert.product}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Perigo: {alert.hazard ?? "—"}
                        {alert.hazard_type ? ` (${alert.hazard_type})` : ""} · Origem: {alert.origin_country ?? "—"}
                        {alert.manufacturer ? ` · Fabricante: ${alert.manufacturer}` : ""}
                      </p>
                    </div>
                  ) : null}

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Razão do risco</dt>
                      <dd className="mt-1">{finding.reason ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Rastreabilidade</dt>
                      <dd className="mt-1">{finding.traceability ?? "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Ação recomendada</dt>
                      <dd className="mt-1">{finding.recommendation ?? "—"}</dd>
                    </div>
                  </dl>

                  <Textarea
                    defaultValue={finding.review_note ?? ""}
                    placeholder="Nota de revisão da equipa de qualidade…"
                    className="mt-3 min-h-16 text-sm"
                    onBlur={(event) => {
                      if (event.target.value !== (finding.review_note ?? "")) {
                        void updateFinding(finding.id, { review_note: event.target.value || null });
                      }
                    }}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Alertas analisados ({data.alerts.length})</h2>
        <div className="panel divide-y divide-border overflow-hidden">
          {data.alerts.map((alert) => (
            <div key={alert.id} className="p-4 text-sm">
              <p className="font-medium">
                {alert.reference ? `${alert.reference} · ` : ""}
                {alert.product}
              </p>
              <p className="mt-1 text-muted-foreground">
                {alert.hazard ?? "—"}
                {alert.hazard_type ? ` (${alert.hazard_type})` : ""} · {alert.origin_country ?? "origem n/d"}
                {alert.manufacturer ? ` · ${alert.manufacturer}` : ""}
                {alert.notified_on ? ` · ${new Date(alert.notified_on).toLocaleDateString("pt-PT")}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
