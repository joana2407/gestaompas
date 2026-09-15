import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { Input } from "@/components/ui/input";
import { TIPOS_DOCUMENTO, validityState } from "@/lib/domain";
import { gateStatus } from "@/lib/gate.functions";
import { documentsQuery } from "@/lib/queries";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentação e validades | Gestão de MP" },
      {
        name: "description",
        content:
          "Arquivo central de fichas técnicas, certificações e declarações, com controlo de versões e validade para auditorias BRC e AOCS.",
      },
      { property: "og:title", content: "Documentação e validades" },
      { property: "og:description", content: "Versões, datas e validade de toda a documentação de fornecedores e MP." },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(documentsQuery),
  component: DocumentsPage,
});

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "expirado", label: "Expirados" },
  { id: "expira", label: "A expirar (60 dias)" },
  { id: "sem_ficheiro", label: "Sem ficheiro anexado" },
] as const;

function DocumentsPage() {
  const { data } = useSuspenseQuery(documentsQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todos");
  const [docType, setDocType] = useState("todos");

  const term = search.trim().toLowerCase();
  const filtered = data.documents.filter((doc) => {
    if (docType !== "todos" && doc.doc_type !== docType) return false;
    const state = validityState(doc.expires_on);
    if (filter === "expirado" && state !== "expirado") return false;
    if (filter === "expira" && !["expira_30", "expira_60"].includes(state)) return false;
    if (filter === "sem_ficheiro" && doc.storage_path) return false;
    if (!term) return true;
    const supplier = data.suppliers.find((s) => s.id === doc.supplier_id)?.name ?? "";
    const material = data.materials.find((m) => m.id === doc.raw_material_id)?.name ?? "";
    return `${doc.title} ${supplier} ${material}`.toLowerCase().includes(term);
  });

  return (
    <AppShell
      title="Documentação"
      description="Arquivo central com versões, datas de emissão e validade, pronto para auditoria."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por documento, fornecedor ou MP"
            className="pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as (typeof FILTERS)[number]["id"])}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="todos">Todos os tipos</option>
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <DocumentsPanel
        documents={filtered}
        suppliers={data.suppliers}
        materials={data.materials}
        title={`${filtered.length} documento(s)`}
      />
    </AppShell>
  );
}
