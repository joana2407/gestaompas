import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** All data access is gated: the browser has no direct database access. */
async function gate() {
  const { requireUnlocked } = await import("./gate.server");
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listMaterials = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const { data, error } = await db
    .from("raw_materials")
    .select("id, code, name, category, kind, origins, supplier, notes, raw_material_ingredients(id, name, origin)")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listAnalyses = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const { data, error } = await db
    .from("analyses")
    .select("id, week_label, week_start, source_filename, status, summary, total_alerts, total_at_risk, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listFindingsOverview = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const { data, error } = await db
    .from("risk_findings")
    .select("id, analysis_id, risk_level, risk_type, raw_material_name, reviewed");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getAnalysisDetail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ analysisId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const [analysis, alerts, findings] = await Promise.all([
      db
        .from("analyses")
        .select("id, week_label, week_start, source_filename, status, summary, total_alerts, total_at_risk, created_at")
        .eq("id", data.analysisId)
        .maybeSingle(),
      db
        .from("rasff_alerts")
        .select("id, reference, product, hazard, hazard_type, origin_country, manufacturer, notified_on")
        .eq("analysis_id", data.analysisId)
        .order("created_at"),
      db
        .from("risk_findings")
        .select(
          "id, alert_id, raw_material_id, raw_material_name, raw_material_kind, ingredient_name, risk_level, risk_type, reason, recommendation, traceability, reviewed, review_note",
        )
        .eq("analysis_id", data.analysisId)
        .order("risk_level"),
    ]);
    if (analysis.error) throw new Error(analysis.error.message);
    if (alerts.error) throw new Error(alerts.error.message);
    if (findings.error) throw new Error(findings.error.message);
    return { analysis: analysis.data, alerts: alerts.data ?? [], findings: findings.data ?? [] };
  });

const materialInput = z.object({
  code: z.string().nullish(),
  name: z.string().min(1),
  category: z.string().nullish(),
  kind: z.string(),
  origins: z.array(z.string()),
  supplier: z.string().nullish(),
  notes: z.string().nullish(),
  ingredients: z.array(z.object({ name: z.string().min(1), origin: z.string().nullish() })),
});

export const replaceInventory = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ materials: z.array(materialInput).min(1) }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();

    await db.from("raw_materials").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { data: inserted, error } = await db
      .from("raw_materials")
      .insert(
        data.materials.map((m) => ({
          code: m.code ?? null,
          name: m.name,
          category: m.category ?? null,
          kind: m.kind,
          origins: m.origins,
          supplier: m.supplier ?? null,
          notes: m.notes ?? null,
        })),
      )
      .select("id, name");
    if (error) throw new Error(error.message);

    const ingredientRows = data.materials.flatMap((m, index) => {
      const materialId = inserted?.[index]?.id;
      if (!materialId) return [];
      return m.ingredients.map((i) => ({ raw_material_id: materialId, name: i.name, origin: i.origin ?? null }));
    });
    if (ingredientRows.length > 0) {
      const { error: ingredientError } = await db.from("raw_material_ingredients").insert(ingredientRows);
      if (ingredientError) throw new Error(ingredientError.message);
    }

    return { imported: data.materials.length };
  });

export const createMaterial = createServerFn({ method: "POST" })
  .inputValidator((data) => materialInput.parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { data: inserted, error } = await db
      .from("raw_materials")
      .insert({
        code: data.code ?? null,
        name: data.name,
        category: data.category ?? null,
        kind: data.ingredients.length > 1 ? "composta" : data.kind,
        origins: data.origins,
        supplier: data.supplier ?? null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.ingredients.length > 0) {
      const { error: ingredientError } = await db.from("raw_material_ingredients").insert(
        data.ingredients.map((i) => ({
          raw_material_id: inserted.id,
          name: i.name,
          origin: i.origin ?? null,
        })),
      );
      if (ingredientError) throw new Error(ingredientError.message);
    }

    return { id: inserted.id };
  });

export const setIngredients = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        materialId: z.string().uuid(),
        names: z.array(z.string().min(1)),
        fallbackKind: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await gate();

    await db.from("raw_material_ingredients").delete().eq("raw_material_id", data.materialId);
    if (data.names.length > 0) {
      const { error } = await db
        .from("raw_material_ingredients")
        .insert(data.names.map((name) => ({ raw_material_id: data.materialId, name, origin: null })));
      if (error) throw new Error(error.message);
    }
    const { error: kindError } = await db
      .from("raw_materials")
      .update({ kind: data.names.length > 1 ? "composta" : data.fallbackKind })
      .eq("id", data.materialId);
    if (kindError) throw new Error(kindError.message);

    return { ok: true as const };
  });

export const updateFinding = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        risk_level: z.enum(["ALTO", "MEDIO", "BAIXO"]).optional(),
        reviewed: z.boolean().optional(),
        review_note: z.string().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await gate();
    const patch: { risk_level?: string; reviewed?: boolean; review_note?: string | null } = {};
    if (data.risk_level !== undefined) patch.risk_level = data.risk_level;
    if (data.reviewed !== undefined) patch.reviewed = data.reviewed;
    if (data.review_note !== undefined) patch.review_note = data.review_note ?? null;
    const { error } = await db.from("risk_findings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setAnalysisStatus = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), status: z.enum(["rascunho", "fechado"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db.from("analyses").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

function weekNum(label: string | null, start: string | null) {
  const m = (label ?? "").match(/(\d{1,2})\s*\/\s*(\d{4})/);
  if (m) return { week: Number(m[1]), year: Number(m[2]) };
  if (start) {
    const d = new Date(start + "T00:00:00Z");
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { week: Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7), year: t.getUTCFullYear() };
  }
  return null;
}

export const listSurveillance = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const { data: analyses, error } = await db
    .from("analyses")
    .select("id, week_label, week_start")
    .order("week_start", { ascending: false });
  if (error) throw new Error(error.message);
  const weeks = (analyses ?? [])
    .map((a) => ({ ...a, wk: weekNum(a.week_label, a.week_start) }))
    .filter((a) => a.wk && (a.wk.year > 2026 || (a.wk.year === 2026 && a.wk.week >= 38)));
  const ids = weeks.map((w) => w.id);
  if (!ids.length) return [];
  const [alerts, findings] = await Promise.all([
    db.from("rasff_alerts")
      .select("id, analysis_id, reference, product, hazard, origin_country, notified_on, closed, closed_at, closed_by")
      .in("analysis_id", ids).limit(10000),
    db.from("risk_findings")
      .select("alert_id, raw_material_name, risk_level").in("analysis_id", ids).limit(10000),
  ]);
  if (alerts.error) throw new Error(alerts.error.message);
  if (findings.error) throw new Error(findings.error.message);
  const byAlert = new Map<string, { name: string; level: string }[]>();
  for (const f of findings.data ?? []) {
    if (!f.alert_id) continue;
    const arr = byAlert.get(f.alert_id) ?? [];
    arr.push({ name: f.raw_material_name, level: f.risk_level });
    byAlert.set(f.alert_id, arr);
  }
  return weeks.map((w) => ({
    id: w.id,
    label: w.week_label,
    week: w.wk!.week,
    year: w.wk!.year,
    alerts: (alerts.data ?? [])
      .filter((a) => a.analysis_id === w.id)
      .map((a) => ({ ...a, materials: byAlert.get(a.id) ?? [] })),
  }));
});

export const setAlertClosed = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ alertId: z.string().uuid(), closed: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { currentUser } = await import("./gate.server");
    const user = await currentUser();
    const { error } = await db
      .from("rasff_alerts")
      .update({
        closed: data.closed,
        closed_at: data.closed ? new Date().toISOString() : null,
        closed_by: data.closed ? user?.name ?? null : null,
      })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
