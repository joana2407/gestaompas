import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RiskLevel = "ALTO" | "MEDIO" | "BAIXO";

export const materialsQuery = queryOptions({
  queryKey: ["raw_materials"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("raw_materials")
      .select("id, code, name, category, kind, origins, supplier, notes, raw_material_ingredients(id, name, origin)")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const analysesQuery = queryOptions({
  queryKey: ["analyses"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("analyses")
      .select("id, week_label, week_start, source_filename, status, summary, total_alerts, total_at_risk, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const findingsOverviewQuery = queryOptions({
  queryKey: ["findings_overview"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("risk_findings")
      .select("id, analysis_id, risk_level, risk_type, raw_material_name, reviewed");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export function analysisDetailQuery(analysisId: string) {
  return queryOptions({
    queryKey: ["analysis", analysisId],
    queryFn: async () => {
      const [analysis, alerts, findings] = await Promise.all([
        supabase
          .from("analyses")
          .select("id, week_label, week_start, source_filename, status, summary, total_alerts, total_at_risk, created_at")
          .eq("id", analysisId)
          .maybeSingle(),
        supabase
          .from("rasff_alerts")
          .select("id, reference, product, hazard, hazard_type, origin_country, manufacturer, notified_on")
          .eq("analysis_id", analysisId)
          .order("created_at"),
        supabase
          .from("risk_findings")
          .select(
            "id, alert_id, raw_material_id, raw_material_name, raw_material_kind, ingredient_name, risk_level, risk_type, reason, recommendation, traceability, reviewed, review_note",
          )
          .eq("analysis_id", analysisId)
          .order("risk_level"),
      ]);
      if (analysis.error) throw new Error(analysis.error.message);
      if (alerts.error) throw new Error(alerts.error.message);
      if (findings.error) throw new Error(findings.error.message);
      return { analysis: analysis.data, alerts: alerts.data ?? [], findings: findings.data ?? [] };
    },
  });
}
