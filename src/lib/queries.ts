import { queryOptions } from "@tanstack/react-query";
import {
  getAnalysisDetail,
  listAnalyses,
  listFindingsOverview,
  listMaterials,
} from "@/lib/data.functions";

export type RiskLevel = "ALTO" | "MEDIO" | "BAIXO";

export const materialsQuery = queryOptions({
  queryKey: ["raw_materials"],
  queryFn: () => listMaterials(),
});

export const analysesQuery = queryOptions({
  queryKey: ["analyses"],
  queryFn: () => listAnalyses(),
});

export const findingsOverviewQuery = queryOptions({
  queryKey: ["findings_overview"],
  queryFn: () => listFindingsOverview(),
});

export function analysisDetailQuery(analysisId: string) {
  return queryOptions({
    queryKey: ["analysis", analysisId],
    queryFn: () => getAnalysisDetail({ data: { analysisId } }),
  });
}
