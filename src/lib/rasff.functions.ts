import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

async function askAI(system: string, user: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A análise automática não está disponível (chave de IA ausente).");

  // Streaming keeps bytes flowing: a buffered call on a long RASFF listing gets
  // severed by the edge with a 524 before the model finishes.
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    console.error(`AI gateway failed [${response.status}]: ${body}`);
    if (response.status === 429) throw new Error("Limite de utilização da IA atingido. Tente novamente daqui a pouco.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados no espaço de trabalho.");
    throw new Error(`A análise falhou [${response.status}].`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        content += chunk.choices?.[0]?.delta?.content ?? "";
      } catch {
        // partial chunk, ignore
      }
    }
  }

  if (!content.trim()) throw new Error("A IA não devolveu resultados. Tente novamente.");

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
  }
}

const alertSchema = z.object({
  reference: z.string().nullish(),
  product: z.string().nullish(),
  hazard: z.string().nullish(),
  hazard_type: z.string().nullish(),
  origin_country: z.string().nullish(),
  manufacturer: z.string().nullish(),
  notified_on: z.string().nullish(),
  raw_text: z.string().nullish(),
});

const findingSchema = z.object({
  alert_reference: z.string().nullish(),
  raw_material_code: z.string().nullish(),
  raw_material_name: z.string().nullish(),
  raw_material_kind: z.string().nullish(),
  ingredient_name: z.string().nullish(),
  risk_level: z.string().nullish(),
  risk_type: z.string().nullish(),
  reason: z.string().nullish(),
  recommendation: z.string().nullish(),
  traceability: z.string().nullish(),
});

function normalizeLevel(value?: string | null) {
  const v = (value ?? "").toLowerCase();
  if (v.includes("alto") || v.includes("high")) return "ALTO";
  if (v.includes("baixo") || v.includes("low")) return "BAIXO";
  return "MEDIO";
}

export const runRasffAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        weekLabel: z.string().min(1),
        weekStart: z.string().nullish(),
        filename: z.string().nullish(),
        text: z.string().min(20),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: materials, error: materialsError } = await supabaseAdmin
      .from("raw_materials")
      .select("id, code, name, category, kind, origins, supplier, raw_material_ingredients(name, origin)");
    if (materialsError) throw new Error(materialsError.message);
    if (!materials || materials.length === 0) {
      throw new Error("Importe primeiro o inventário de matérias-primas antes de correr a análise.");
    }

    const extractionSystem = [
      "És especialista em segurança alimentar e analisas notificações RASFF.",
      "Extrai TODOS os alertas do documento fornecido.",
      'Responde apenas JSON: {"alerts":[{"reference","product","hazard","hazard_type","origin_country","manufacturer","notified_on","raw_text"}]}.',
      "hazard_type deve ser um de: alergénio, microbiológico, químico, corpo estranho, fraude, radiação, outro.",
      "notified_on em formato YYYY-MM-DD ou null. Escreve em português.",
    ].join(" ");

    // Split long listings so each model call stays short enough to finish.
    const textChunks: string[] = [];
    const full = data.text.slice(0, 200000);
    const CHUNK = 25000;
    for (let i = 0; i < full.length; i += CHUNK) textChunks.push(full.slice(i, i + CHUNK));

    const alerts: z.infer<typeof alertSchema>[] = [];
    for (const chunk of textChunks) {
      const extraction = await askAI(extractionSystem, chunk);
      alerts.push(
        ...z
          .array(alertSchema)
          .catch([])
          .parse(extraction["alerts"] ?? [])
          .filter((a) => a.product && a.product.trim().length > 1),
      );
    }

    if (alerts.length === 0) throw new Error("Não foi possível identificar alertas no documento enviado.");

    const inventoryForAI = materials.map((m) => ({
      codigo: m.code,
      nome: m.name,
      categoria: m.category,
      tipo: m.kind,
      origens: m.origins,
      fornecedor: m.supplier,
      ingredientes: (m.raw_material_ingredients ?? []).map((i) => ({ nome: i.name, origem: i.origin })),
    }));

    const assessment = await askAI(
      [
        "És auditor de segurança alimentar numa empresa de panificação e pastelaria certificada BRC Food.",
        "Cruza os alertas RASFF com o inventário de matérias-primas (MP) e devolve apenas as MP com risco real.",
        "Regras de classificação:",
        "ALTO: a MP ou um ingrediente componente é o produto do alerta, ou provém da mesma origem/fabricante do alerta.",
        "MEDIO: a origem geográfica coincide e o tipo de produto é similar, mas a confirmação é incerta.",
        "BAIXO: a origem coincide mas o tipo de produto ou fabricante é claramente diferente.",
        "risk_type deve ser: direto, indireto ou origem.",
        "traceability deve indicar se a MP é simples ou composta e se o risco vem da própria MP ou de um ingrediente.",
        "recommendation deve ser acionável (verificação com fornecedor, suspensão de uso, re-teste, substituição, pedido de COA, etc.).",
        'Responde apenas JSON: {"summary":"sumário executivo em português","findings":[{"alert_reference","raw_material_code","raw_material_name","raw_material_kind","ingredient_name","risk_level","risk_type","reason","recommendation","traceability"}]}',
        "Escreve tudo em português de Portugal. Não inventes MP que não estejam no inventário.",
      ].join(" "),
      JSON.stringify({ alertas: alerts, inventario: inventoryForAI }).slice(0, 200000),
    );

    const findings = z.array(findingSchema).catch([]).parse(assessment["findings"] ?? []);
    const summary = typeof assessment["summary"] === "string" ? (assessment["summary"] as string) : null;

    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from("analyses")
      .insert({
        week_label: data.weekLabel,
        week_start: data.weekStart || null,
        source_filename: data.filename || null,
        summary,
        total_alerts: alerts.length,
      })
      .select("id")
      .single();
    if (analysisError || !analysis) throw new Error(analysisError?.message ?? "Falha ao guardar a análise.");

    const { data: insertedAlerts, error: alertError } = await supabaseAdmin
      .from("rasff_alerts")
      .insert(
        alerts.map((a) => ({
          analysis_id: analysis.id,
          reference: a.reference ?? null,
          product: a.product!,
          hazard: a.hazard ?? null,
          hazard_type: a.hazard_type ?? null,
          origin_country: a.origin_country ?? null,
          manufacturer: a.manufacturer ?? null,
          notified_on: a.notified_on && /^\d{4}-\d{2}-\d{2}$/.test(a.notified_on) ? a.notified_on : null,
          raw_text: a.raw_text ?? null,
        })),
      )
      .select("id, reference, product");
    if (alertError) throw new Error(alertError.message);

    const findAlertId = (reference?: string | null) => {
      if (!insertedAlerts?.length) return null;
      const ref = (reference ?? "").trim().toLowerCase();
      const byRef = insertedAlerts.find((a) => (a.reference ?? "").trim().toLowerCase() === ref && ref);
      return (byRef ?? null)?.id ?? null;
    };

    const findMaterial = (code?: string | null, name?: string | null) => {
      const c = (code ?? "").trim().toLowerCase();
      const n = (name ?? "").trim().toLowerCase();
      return (
        materials.find((m) => c && (m.code ?? "").trim().toLowerCase() === c) ??
        materials.find((m) => n && m.name.trim().toLowerCase() === n) ??
        null
      );
    };

    const rows = findings
      .filter((f) => f.raw_material_name || f.raw_material_code)
      .map((f) => {
        const material = findMaterial(f.raw_material_code, f.raw_material_name);
        return {
          analysis_id: analysis.id,
          alert_id: findAlertId(f.alert_reference),
          raw_material_id: material?.id ?? null,
          raw_material_name: material?.name ?? f.raw_material_name ?? f.raw_material_code!,
          raw_material_kind: material?.kind ?? f.raw_material_kind ?? null,
          ingredient_name: f.ingredient_name ?? null,
          risk_level: normalizeLevel(f.risk_level),
          risk_type: f.risk_type ?? null,
          reason: f.reason ?? null,
          recommendation: f.recommendation ?? null,
          traceability: f.traceability ?? null,
        };
      });

    if (rows.length > 0) {
      const { error: findingError } = await supabaseAdmin.from("risk_findings").insert(rows);
      if (findingError) throw new Error(findingError.message);
    }

    const distinct = new Set(rows.map((r) => r.raw_material_name)).size;
    await supabaseAdmin.from("analyses").update({ total_at_risk: distinct }).eq("id", analysis.id);

    return { analysisId: analysis.id, alerts: alerts.length, findings: rows.length, atRisk: distinct };
  });
