import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, FileWarning, Search, ShieldAlert, Users } from "lucide-react";

import { AllergenTags } from "@/components/AllergenTags";
import { AppShell } from "@/components/AppShell";
import { AllergenIcon, FactoryChip, TONE_CHIP, allergenTone } from "@/components/icons";
import { ValidityBadge } from "@/components/ValidityBadge";
import { Input } from "@/components/ui/input";
import {
  ALERGENIOS_CRITICOS,
  alergenioLabel,
  daysUntil,
  formatDate,
  tipoDocumentoLabel,
  validityCountdown,
  validityState,
  type AlergenioId,
} from "@/lib/domain";
import { gateStatus } from "@/lib/gate.functions";
import { catalogQuery } from "@/lib/queries";

export const Route = createFileRoute("/conformidade")({
  head: () => ({
    meta: [
      { title: "Painel de conformidade BRC | Gestão de MP" },
      {
        name: "description",
        content:
          "Documentos expirados, fornecedores secundários, alergénios críticos e estado da documentação por matéria-prima e por fornecedor.",
      },
      { property: "og:title", content: "Painel de conformidade BRC" },
      {
        property: "og:description",
        content: "Avisos de validade documental, múltiplos fornecedores e alergénios críticos numa só vista.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: CompliancePage,
});

/** Documentação mínima exigida por MP/fornecedor em BRC e AOCS. */
const OBRIGATORIOS = ["ficha_tecnica", "declaracao_alergenios"] as const;

type DocRow = {
  id: string;
  supplier_id: string | null;
  raw_material_id: string | null;
  doc_type: string;
  title: string;
  version: string;
  expires_on: string | null;
};

type Estado = "conforme" | "atencao" | "critico";

const ESTADO_LABEL: Record<Estado, string> = {
  conforme: "Documentação completa",
  atencao: "A regularizar",
  critico: "Não conforme",
};

const ESTADO_TONE: Record<Estado, string> = {
  conforme: "border-low/30 bg-low-soft text-low",
  atencao: "border-medium/50 bg-medium-soft text-medium-foreground",
  critico: "border-high/40 bg-high-soft text-high",
};

function docStatus(docs: DocRow[]) {
  const expired = docs.filter((d) => validityState(d.expires_on) === "expirado");
  const expiring = docs.filter((d) => ["expira_30", "expira_60"].includes(validityState(d.expires_on)));
  const missing = OBRIGATORIOS.filter(
    (type) => !docs.some((d) => d.doc_type === type && validityState(d.expires_on) !== "expirado"),
  );
  const estado: Estado = expired.length > 0 || missing.length > 0 ? "critico" : expiring.length > 0 ? "atencao" : "conforme";
  return { expired, expiring, missing, estado };
}

const FILTROS = [
  { id: "todos", label: "Tudo" },
  { id: "criticos", label: "Só não conformes" },
  { id: "expirados", label: "Com documentos expirados" },
  { id: "multi", label: "Com fornecedores secundários" },
  { id: "alergenios", label: "Com alergénios críticos" },
] as const;

function CompliancePage() {
  const { data } = useSuspenseQuery(catalogQuery);
  const [view, setView] = useState<"mp" | "fornecedor">("mp");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");

  const docs = data.documents as DocRow[];

  const materials = useMemo(() => {
    return data.materials.map((material) => {
      const links = data.materialSuppliers.filter((l) => l.raw_material_id === material.id);
      const suppliers = links
        .map((link) => {
          const supplier = data.suppliers.find((s) => s.id === link.supplier_id);
          const supplierDocs = docs.filter(
            (d) => d.raw_material_id === material.id && d.supplier_id === link.supplier_id,
          );
          return {
            linkId: link.id,
            id: link.supplier_id,
            name: supplier?.name ?? "Fornecedor",
            preferred: link.preferred,
            origin: link.origin_country,
            reference: link.supplier_reference,
            docs: supplierDocs,
            status: docStatus(supplierDocs),
          };
        })
        .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.name.localeCompare(b.name));

      const critical = [
        ...(material.allergens_formulation ?? []),
        ...(material.allergens_contamination ?? []),
      ].filter((a) => ALERGENIOS_CRITICOS.includes(a as AlergenioId));
      const materialDocs = docs.filter((d) => d.raw_material_id === material.id);
      const status = docStatus(materialDocs);
      const worst: Estado = suppliers.some((s) => s.status.estado === "critico")
        ? "critico"
        : suppliers.some((s) => s.status.estado === "atencao")
          ? "atencao"
          : status.estado;

      const factories = data.materialFactories
        .filter((mf) => mf.raw_material_id === material.id && mf.state !== "inativa")
        .map((mf) => data.factories.find((f) => f.id === mf.factory_id))
        .filter(Boolean)
        .map((f) => ({ id: f!.id, code: f!.code, name: f!.name }));

      return {
        id: material.id,
        name: material.name,
        code: material.code,
        factories,
        formulation: (material.allergens_formulation ?? []) as string[],
        contamination: (material.allergens_contamination ?? []) as string[],
        critical: Array.from(new Set(critical)),
        suppliers,
        secondary: suppliers.filter((s) => !s.preferred),
        docs: materialDocs,
        status,
        estado: suppliers.length === 0 ? "critico" : worst,
      };
    });
  }, [data, docs]);

  const suppliersView = useMemo(() => {
    return data.suppliers
      .map((supplier) => {
        const links = data.materialSuppliers.filter((l) => l.supplier_id === supplier.id);
        const supplierDocs = docs.filter((d) => d.supplier_id === supplier.id);
        const rows = links.map((link) => {
          const material = data.materials.find((m) => m.id === link.raw_material_id);
          const perMaterial = supplierDocs.filter((d) => d.raw_material_id === link.raw_material_id);
          const critical = [
            ...((material?.allergens_formulation ?? []) as string[]),
            ...((material?.allergens_contamination ?? []) as string[]),
          ].filter((a) => ALERGENIOS_CRITICOS.includes(a as AlergenioId));
          return {
            linkId: link.id,
            materialId: link.raw_material_id,
            materialName: material?.name ?? "Matéria-prima",
            preferred: link.preferred,
            critical: Array.from(new Set(critical)),
            docs: perMaterial,
            status: docStatus(perMaterial),
          };
        });
        return {
          id: supplier.id,
          name: supplier.name,
          code: supplier.code,
          supplierStatus: supplier.status,
          rows: rows.sort((a, b) => a.materialName.localeCompare(b.materialName)),
          docs: supplierDocs,
          expired: supplierDocs.filter((d) => validityState(d.expires_on) === "expirado").length,
          expiring: supplierDocs.filter((d) => ["expira_30", "expira_60"].includes(validityState(d.expires_on))).length,
          secondaryCount: rows.filter((r) => !r.preferred).length,
        };
      })
      .filter((s) => s.rows.length > 0 || s.docs.length > 0);
  }, [data, docs]);

  const kpis = {
    expired: docs.filter((d) => validityState(d.expires_on) === "expirado").length,
    expiring: docs.filter((d) => ["expira_30", "expira_60"].includes(validityState(d.expires_on))).length,
    multi: materials.filter((m) => m.secondary.length > 0).length,
    critical: materials.filter((m) => m.critical.length > 0).length,
    naoConformes: materials.filter((m) => m.estado === "critico").length,
  };

  const term = search.trim().toLowerCase();

  const materialsFiltered = materials.filter((m) => {
    if (filtro === "criticos" && m.estado !== "critico") return false;
    if (filtro === "expirados" && m.status.expired.length === 0 && !m.suppliers.some((s) => s.status.expired.length > 0))
      return false;
    if (filtro === "multi" && m.secondary.length === 0) return false;
    if (filtro === "alergenios" && m.critical.length === 0) return false;
    if (!term) return true;
    return `${m.name} ${m.code ?? ""} ${m.suppliers.map((s) => s.name).join(" ")}`.toLowerCase().includes(term);
  });

  const suppliersFiltered = suppliersView.filter((s) => {
    if (filtro === "criticos" && !s.rows.some((r) => r.status.estado === "critico")) return false;
    if (filtro === "expirados" && s.expired === 0) return false;
    if (filtro === "multi" && s.secondaryCount === 0) return false;
    if (filtro === "alergenios" && !s.rows.some((r) => r.critical.length > 0)) return false;
    if (!term) return true;
    return `${s.name} ${s.code ?? ""} ${s.rows.map((r) => r.materialName).join(" ")}`.toLowerCase().includes(term);
  });

  return (
    <AppShell
      title="Painel de conformidade"
      description="Validade documental, fornecedores secundários e alergénios críticos por matéria-prima e por fornecedor."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={ShieldAlert} label="MP não conformes" value={kpis.naoConformes} tone="critico" />
        <Kpi icon={FileWarning} label="Documentos expirados" value={kpis.expired} tone="critico" />
        <Kpi icon={FileWarning} label="A expirar (60 dias)" value={kpis.expiring} tone="atencao" />
        <Kpi icon={Users} label="MP com fornecedor secundário" value={kpis.multi} tone="atencao" />
        <Kpi icon={AlertTriangle} label="MP com alergénio crítico" value={kpis.critical} tone="atencao" />
      </div>

      <div className="mt-4 mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["mp", "fornecedor"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {v === "mp" ? "Por matéria-prima" : "Por fornecedor"}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar MP ou fornecedor"
            className="pl-9"
          />
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as (typeof FILTROS)[number]["id"])}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {FILTROS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {view === "mp" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{materialsFiltered.length} matéria(s)-prima(s)</p>
          {materialsFiltered.map((m) => (
            <section key={m.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to="/materia-prima/$materialId"
                    params={{ materialId: m.id }}
                    className="font-display text-sm font-semibold hover:underline"
                  >
                    {m.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {m.code ? `${m.code} · ` : ""}
                    {m.suppliers.length} fornecedor(es) · {m.docs.length} documento(s)
                  </p>
                </div>
                <EstadoBadge estado={m.estado as Estado} />
              </div>

              <div className="mt-2">
                <AllergenTags
                  formulation={m.formulation}
                  contamination={m.contamination}
                  empty="Alergénios não registados"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.factories.length > 0 ? (
                  m.factories.map((f) => <FactoryChip key={f.id} code={f.code} name={f.code} />)
                ) : (
                  <span className="text-xs text-muted-foreground">Sem fábrica atribuída</span>
                )}
                {m.critical.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-high/40 bg-high-soft px-2 py-0.5 text-xs font-semibold text-high">
                    <AlertTriangle className="size-3" /> Críticos:
                    {m.critical.map((a) => (
                      <span
                        key={a}
                        title={alergenioLabel(a)}
                        className={`ml-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${TONE_CHIP[allergenTone(a)]}`}
                      >
                        <AllergenIcon id={a} className="size-3" />
                        {alergenioLabel(a)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sem alergénios críticos declarados</span>
                )}
                {m.secondary.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-medium/50 bg-medium-soft px-2 py-0.5 text-xs font-medium text-medium-foreground">
                    <Users className="size-3" /> {m.secondary.length} fornecedor(es) secundário(s): confirmar
                    equivalência
                  </span>
                ) : null}
                {m.suppliers.length === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-high/40 bg-high-soft px-2 py-0.5 text-xs font-medium text-high">
                    <AlertTriangle className="size-3" /> Sem fornecedor associado
                  </span>
                ) : null}
              </div>

              {m.suppliers.length > 0 ? (
                <ul className="mt-3 divide-y divide-border border-t border-border">
                  {m.suppliers.map((s) => (
                    <li key={s.linkId} className="flex flex-wrap items-start gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/fornecedor/$supplierId"
                          params={{ supplierId: s.id }}
                          className="text-sm font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.preferred ? "preferencial" : "secundário"}
                          {s.origin ? ` · origem ${s.origin}` : ""}
                          {s.reference ? ` · ref. ${s.reference}` : ""}
                        </span>
                        <DocLines docs={s.docs} missing={s.status.missing} />
                      </div>
                      <EstadoBadge estado={s.status.estado} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{suppliersFiltered.length} fornecedor(es)</p>
          {suppliersFiltered.map((s) => (
            <section key={s.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to="/fornecedor/$supplierId"
                    params={{ supplierId: s.id }}
                    className="font-display text-sm font-semibold hover:underline"
                  >
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {s.code ? `${s.code} · ` : ""}
                    {s.rows.length} MP · {s.docs.length} documento(s)
                  </p>
                  <NextExpiry docs={s.docs} label="Validade do fornecedor" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.expired > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-high/40 bg-high-soft px-2 py-0.5 text-xs font-medium text-high">
                      <FileWarning className="size-3" /> {s.expired} expirado(s)
                    </span>
                  ) : null}
                  {s.expiring > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-medium/50 bg-medium-soft px-2 py-0.5 text-xs font-medium text-medium-foreground">
                      {s.expiring} a expirar
                    </span>
                  ) : null}
                  {s.secondaryCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-medium/50 bg-medium-soft px-2 py-0.5 text-xs font-medium text-medium-foreground">
                      <Users className="size-3" /> secundário em {s.secondaryCount} MP
                    </span>
                  ) : null}
                </div>
              </div>

              <ul className="mt-3 divide-y divide-border border-t border-border">
                {s.rows.map((r) => (
                  <li key={r.linkId} className="flex flex-wrap items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      {r.materialId ? (
                        <Link
                          to="/materia-prima/$materialId"
                          params={{ materialId: r.materialId }}
                          className="text-sm font-medium hover:underline"
                        >
                          {r.materialName}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{r.materialName}</span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.preferred ? "preferencial" : "secundário"}
                      </span>
                      {r.critical.length > 0 ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-high/40 bg-high-soft px-2 py-0.5 text-xs font-medium text-high">
                          <AlertTriangle className="size-3" /> {r.critical.map((a) => alergenioLabel(a)).join(", ")}
                        </span>
                      ) : null}
                      <NextExpiry docs={r.docs} label="Validade nesta MP" />
                      <DocLines docs={r.docs} missing={r.status.missing} />
                    </div>
                    <EstadoBadge estado={r.status.estado} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function DocLines({ docs, missing }: { docs: DocRow[]; missing: readonly string[] }) {
  return (
    <div className="mt-1.5 space-y-1">
      {missing.length > 0 ? (
        <p className="text-xs font-medium text-high">
          Falta documentação válida: {missing.map((t) => tipoDocumentoLabel(t)).join(", ")}
        </p>
      ) : null}
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem documentos carregados.</p>
      ) : (
        docs
          .slice()
          .sort((a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999"))
          .map((doc) => {
            const countdown = validityCountdown(doc.expires_on);
            const state = validityState(doc.expires_on);
            return (
              <div key={doc.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{tipoDocumentoLabel(doc.doc_type)}</span>
                <span>
                  {doc.title} · v{doc.version} · {formatDate(doc.expires_on)}
                </span>
                <ValidityBadge expiresOn={doc.expires_on} />
                {countdown ? (
                  <span
                    className={
                      state === "expirado"
                        ? "font-medium text-high"
                        : state === "expira_30" || state === "expira_60"
                          ? "font-medium text-medium-foreground"
                          : ""
                    }
                  >
                    {countdown}
                  </span>
                ) : (
                  <span>sem data de validade</span>
                )}
              </div>
            );
          })
      )}
    </div>
  );
}

/** Resumo da validade mais próxima de um conjunto de documentos (MP ou fornecedor). */
function NextExpiry({ docs, label }: { docs: DocRow[]; label: string }) {
  const dated = docs
    .filter((d) => d.expires_on)
    .slice()
    .sort((a, b) => (a.expires_on ?? "").localeCompare(b.expires_on ?? ""));
  const expired = dated.filter((d) => validityState(d.expires_on) === "expirado");
  const next = expired[0] ?? dated[0];
  if (!next) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {label}: sem validades registadas ({docs.length} documento(s))
      </p>
    );
  }
  const state = validityState(next.expires_on);
  const days = daysUntil(next.expires_on);
  const tone =
    state === "expirado"
      ? "border-high/40 bg-high-soft text-high"
      : state === "expira_30" || state === "expira_60"
        ? "border-medium/50 bg-medium-soft text-medium-foreground"
        : "border-low/30 bg-low-soft text-low";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">
        {label}: <span className="font-medium text-foreground">{tipoDocumentoLabel(next.doc_type)}</span> ·{" "}
        {formatDate(next.expires_on)}
      </span>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${tone}`}>
        {validityCountdown(next.expires_on)}
      </span>
      {expired.length > 0 ? (
        <span className="text-high">{expired.length} documento(s) já expirado(s)</span>
      ) : days !== null && days <= 60 ? (
        <span className="text-medium-foreground">renovar com o fornecedor</span>
      ) : null}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: Estado }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ESTADO_TONE[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldAlert;
  label: string;
  value: number;
  tone: "critico" | "atencao";
}) {
  const active = value > 0;
  const color = !active ? "text-muted-foreground" : tone === "critico" ? "text-high" : "text-medium-foreground";
  return (
    <div className="panel flex items-center gap-3 p-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-secondary ${color}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className={`font-display text-xl font-semibold ${color}`}>{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
