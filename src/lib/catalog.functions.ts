import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Todo o acesso é feito no servidor, atrás do PIN da equipa. */
async function gate() {
  const { requireUnlocked } = await import("./gate.server");
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function gateWithUser() {
  const { requireUnlocked, currentUser } = await import("./gate.server");
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { db: supabaseAdmin, user: await currentUser() };
}

const BUCKET = "documentos";

// ─── FÁBRICAS ────────────────────────────────────────────────────────────────

export const listFactories = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const { data, error } = await db
    .from("factories")
    .select("id, code, name, description, blocked_allergens, hygiene_notes, active")
    .order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
});

// ─── FORNECEDORES ────────────────────────────────────────────────────────────

const supplierInput = z.object({
  name: z.string().min(1),
  code: z.string().nullish(),
  commercial_name: z.string().nullish(),
  commercial_email: z.string().nullish(),
  commercial_phone: z.string().nullish(),
  quality_name: z.string().nullish(),
  quality_email: z.string().nullish(),
  quality_phone: z.string().nullish(),
  status: z.enum(["completo", "pendente", "incompleto"]),
  pending_notes: z.string().nullish(),
});

function normalizeSupplier(input: z.infer<typeof supplierInput>) {
  return {
    name: input.name,
    code: input.code ?? null,
    commercial_name: input.commercial_name ?? null,
    commercial_email: input.commercial_email ?? null,
    commercial_phone: input.commercial_phone ?? null,
    quality_name: input.quality_name ?? null,
    quality_email: input.quality_email ?? null,
    quality_phone: input.quality_phone ?? null,
    status: input.status,
    pending_notes: input.pending_notes ?? null,
  };
}

const SUPPLIER_COLS =
  "id, name, code, commercial_name, commercial_email, commercial_phone, quality_name, quality_email, quality_phone, status, pending_notes, active";

export const listSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const [suppliers, links, docs] = await Promise.all([
    db.from("suppliers").select(SUPPLIER_COLS).order("name"),
    db.from("material_suppliers").select("supplier_id, raw_material_id, preferred"),
    db.from("documents").select("id, supplier_id, doc_type, expires_on").eq("archived", false),
  ]);
  if (suppliers.error) throw new Error(suppliers.error.message);
  if (links.error) throw new Error(links.error.message);
  if (docs.error) throw new Error(docs.error.message);
  return {
    suppliers: suppliers.data ?? [],
    links: links.data ?? [],
    documents: docs.data ?? [],
  };
});

export const createSupplier = createServerFn({ method: "POST" })
  .inputValidator((data) => supplierInput.parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { data: inserted, error } = await db.from("suppliers").insert(normalizeSupplier(data)).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const updateSupplier = createServerFn({ method: "POST" })
  .inputValidator((data) => supplierInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { id, ...patch } = data;
    const { error } = await db.from("suppliers").update(normalizeSupplier(patch)).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db.from("suppliers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getSupplierDetail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ supplierId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const [supplier, links, documents] = await Promise.all([
      db.from("suppliers").select(SUPPLIER_COLS).eq("id", data.supplierId).maybeSingle(),
      db
        .from("material_suppliers")
        .select(
          "id, raw_material_id, supplier_reference, origin_country, shelf_life_months, preferred, raw_materials(id, name, code, allergens_formulation, allergens_contamination)",
        )
        .eq("supplier_id", data.supplierId),
      db
        .from("documents")
        .select(
          "id, supplier_id, raw_material_id, doc_type, title, description, version, issued_on, expires_on, storage_path, original_filename, notes, uploaded_by, archived, created_at",
        )
        .eq("supplier_id", data.supplierId)
        .order("created_at", { ascending: false }),
    ]);
    if (supplier.error) throw new Error(supplier.error.message);
    if (links.error) throw new Error(links.error.message);
    if (documents.error) throw new Error(documents.error.message);
    return { supplier: supplier.data, links: links.data ?? [], documents: documents.data ?? [] };
  });

// ─── LIGAÇÕES E ALERGÉNIOS DAS MP ────────────────────────────────────────────

/** Visão global: MP com as suas fábricas, fornecedores e contagem documental. */
export const listCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const [materials, factories, suppliers, matFactories, matSuppliers, documents] = await Promise.all([
    db
      .from("raw_materials")
      .select(
        "id, code, name, category, kind, origins, supplier, notes, allergens_formulation, allergens_contamination, raw_material_ingredients(id, name, origin)",
      )
      .order("name"),
    db.from("factories").select("id, code, name, blocked_allergens").order("code"),
    db.from("suppliers").select("id, name, code, status").order("name"),
    db.from("material_factories").select("id, raw_material_id, factory_id, state"),
    db
      .from("material_suppliers")
      .select("id, raw_material_id, supplier_id, supplier_reference, origin_country, shelf_life_months, preferred"),
    db
      .from("documents")
      .select("id, supplier_id, raw_material_id, doc_type, title, version, expires_on, archived")
      .eq("archived", false),
  ]);
  for (const result of [materials, factories, suppliers, matFactories, matSuppliers, documents]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    materials: materials.data ?? [],
    factories: factories.data ?? [],
    suppliers: suppliers.data ?? [],
    materialFactories: matFactories.data ?? [],
    materialSuppliers: matSuppliers.data ?? [],
    documents: documents.data ?? [],
  };
});

export const getMaterialDetail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const [material, factories, matFactories, matSuppliers, documents, suppliers] = await Promise.all([
      db
        .from("raw_materials")
        .select(
          "id, code, name, category, kind, origins, supplier, notes, allergens_formulation, allergens_contamination, raw_material_ingredients(id, name, origin)",
        )
        .eq("id", data.materialId)
        .maybeSingle(),
      db.from("factories").select("id, code, name, blocked_allergens, hygiene_notes").order("code"),
      db.from("material_factories").select("id, factory_id, state").eq("raw_material_id", data.materialId),
      db
        .from("material_suppliers")
        .select(
          "id, supplier_id, supplier_reference, origin_country, shelf_life_months, preferred, suppliers(id, name, code, status)",
        )
        .eq("raw_material_id", data.materialId),
      db
        .from("documents")
        .select(
          "id, supplier_id, raw_material_id, doc_type, title, description, version, issued_on, expires_on, storage_path, original_filename, notes, uploaded_by, archived, created_at, suppliers(name)",
        )
        .eq("raw_material_id", data.materialId)
        .order("created_at", { ascending: false }),
      db.from("suppliers").select("id, name, code").order("name"),
    ]);
    for (const result of [material, factories, matFactories, matSuppliers, documents, suppliers]) {
      if (result.error) throw new Error(result.error.message);
    }
    return {
      material: material.data,
      factories: factories.data ?? [],
      materialFactories: matFactories.data ?? [],
      materialSuppliers: matSuppliers.data ?? [],
      documents: documents.data ?? [],
      suppliers: suppliers.data ?? [],
    };
  });

export const setMaterialFactories = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        materialId: z.string().uuid(),
        entries: z.array(
          z.object({ factoryId: z.string().uuid(), state: z.enum(["ativa", "para_testes", "inativa"]) }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await gate();
    await db.from("material_factories").delete().eq("raw_material_id", data.materialId);
    if (data.entries.length > 0) {
      const { error } = await db.from("material_factories").insert(
        data.entries.map((entry) => ({
          raw_material_id: data.materialId,
          factory_id: entry.factoryId,
          state: entry.state,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const setMaterialAllergens = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        materialId: z.string().uuid(),
        formulation: z.array(z.string()),
        contamination: z.array(z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db
      .from("raw_materials")
      .update({ allergens_formulation: data.formulation, allergens_contamination: data.contamination })
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const upsertMaterialSupplier = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        materialId: z.string().uuid(),
        supplierId: z.string().uuid(),
        supplier_reference: z.string().nullish(),
        origin_country: z.string().nullish(),
        shelf_life_months: z.number().int().positive().nullish(),
        preferred: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await gate();
    if (data.preferred) {
      await db.from("material_suppliers").update({ preferred: false }).eq("raw_material_id", data.materialId);
    }
    const { error } = await db.from("material_suppliers").upsert(
      {
        raw_material_id: data.materialId,
        supplier_id: data.supplierId,
        supplier_reference: data.supplier_reference ?? null,
        origin_country: data.origin_country ?? null,
        shelf_life_months: data.shelf_life_months ?? null,
        preferred: data.preferred,
      },
      { onConflict: "raw_material_id,supplier_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeMaterialSupplier = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db.from("material_suppliers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── DOCUMENTAÇÃO ────────────────────────────────────────────────────────────

const DOC_COLS =
  "id, supplier_id, raw_material_id, doc_type, title, description, version, issued_on, expires_on, storage_path, original_filename, notes, uploaded_by, superseded_by, archived, created_at";

export const listDocuments = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const [documents, suppliers, materials] = await Promise.all([
    db.from("documents").select(DOC_COLS).order("created_at", { ascending: false }),
    db.from("suppliers").select("id, name").order("name"),
    db.from("raw_materials").select("id, name").order("name"),
  ]);
  for (const result of [documents, suppliers, materials]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    documents: documents.data ?? [],
    suppliers: suppliers.data ?? [],
    materials: materials.data ?? [],
  };
});

const documentInput = z.object({
  supplierId: z.string().uuid().nullish(),
  materialId: z.string().uuid().nullish(),
  doc_type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  version: z.string().min(1),
  issued_on: z.string().nullish(),
  expires_on: z.string().nullish(),
  notes: z.string().nullish(),
  /** Nova versão de um documento existente: o anterior fica arquivado. */
  supersedesId: z.string().uuid().nullish(),
  file: z
    .object({ name: z.string(), contentType: z.string(), base64: z.string() })
    .nullish(),
});

export const saveDocument = createServerFn({ method: "POST" })
  .inputValidator((data) => documentInput.parse(data))
  .handler(async ({ data }) => {
    const { db, user } = await gateWithUser();
    if (!data.supplierId && !data.materialId) {
      throw new Error("Associe o documento a um fornecedor ou a uma matéria-prima.");
    }

    let storagePath: string | null = null;
    if (data.file) {
      const bytes = Uint8Array.from(atob(data.file.base64), (c) => c.charCodeAt(0));
      const safeName = data.file.name.replace(/[^\w.\-]+/g, "_");
      storagePath = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(storagePath, bytes, { contentType: data.file.contentType || "application/octet-stream" });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { data: inserted, error } = await db
      .from("documents")
      .insert({
        supplier_id: data.supplierId ?? null,
        raw_material_id: data.materialId ?? null,
        doc_type: data.doc_type,
        title: data.title,
        description: data.description ?? null,
        version: data.version,
        issued_on: data.issued_on || null,
        expires_on: data.expires_on || null,
        storage_path: storagePath,
        original_filename: data.file?.name ?? null,
        notes: data.notes ?? null,
        uploaded_by: user?.name ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.supersedesId) {
      const { error: archiveError } = await db
        .from("documents")
        .update({ archived: true, superseded_by: inserted.id })
        .eq("id", data.supersedesId);
      if (archiveError) throw new Error(archiveError.message);
    }

    return { id: inserted.id };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { data: doc } = await db.from("documents").select("storage_path").eq("id", data.id).maybeSingle();
    if (doc?.storage_path) await db.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await db.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** URL temporário (10 minutos) para abrir o ficheiro do documento. */
export const documentUrl = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await gate();
    const { data: doc, error } = await db.from("documents").select("storage_path").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc?.storage_path) throw new Error("Este registo não tem ficheiro anexado.");
    const signed = await db.storage.from(BUCKET).createSignedUrl(doc.storage_path, 600);
    if (signed.error) throw new Error(signed.error.message);
    return { url: signed.data.signedUrl };
  });
