import { queryOptions } from "@tanstack/react-query";
import {
  getAnalysisDetail,
  listAnalyses,
  listFindingsOverview,
  listMaterials,
} from "@/lib/data.functions";
import {
  getMaterialDetail,
  getSupplierDetail,
  listCatalog,
  listDocuments,
  listFactories,
  listSuppliers,
} from "@/lib/catalog.functions";

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

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => listCatalog(),
});

export const factoriesQuery = queryOptions({
  queryKey: ["factories"],
  queryFn: () => listFactories(),
});

export const suppliersQuery = queryOptions({
  queryKey: ["suppliers"],
  queryFn: () => listSuppliers(),
});

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: () => listDocuments(),
});

export function supplierDetailQuery(supplierId: string) {
  return queryOptions({
    queryKey: ["supplier", supplierId],
    queryFn: () => getSupplierDetail({ data: { supplierId } }),
  });
}

export function materialDetailQuery(materialId: string) {
  return queryOptions({
    queryKey: ["material", materialId],
    queryFn: () => getMaterialDetail({ data: { materialId } }),
  });
}
