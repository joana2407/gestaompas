import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FilePlus2, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ValidityBadge } from "@/components/ValidityBadge";
import { deleteDocument, documentUrl, saveDocument } from "@/lib/catalog.functions";
import { TIPOS_DOCUMENTO, formatDate, tipoDocumentoLabel } from "@/lib/domain";
import { fileToBase64 } from "@/lib/file-base64";

export type DocumentRow = {
  id: string;
  supplier_id?: string | null;
  raw_material_id?: string | null;
  doc_type: string;
  title: string;
  description?: string | null;
  version: string;
  issued_on: string | null;
  expires_on: string | null;
  storage_path: string | null;
  original_filename?: string | null;
  notes?: string | null;
  uploaded_by?: string | null;
  archived: boolean;
  created_at?: string;
};

const MAX_MB = 20;

export function DocumentsPanel({
  documents,
  suppliers,
  materials,
  fixedSupplierId,
  fixedMaterialId,
  supplierOptions,
  supplierRequired = false,
  title = "Documentação",
}: {
  documents: DocumentRow[];
  suppliers: { id: string; name: string }[];
  materials: { id: string; name: string }[];
  fixedSupplierId?: string | undefined;
  fixedMaterialId?: string | undefined;
  /** Fornecedores que podem ser escolhidos no formulário (por omissão, todos). */
  supplierOptions?: { id: string; name: string }[] | undefined;
  /** Obriga a indicar o fornecedor do documento (fichas técnicas de MP). */
  supplierRequired?: boolean;
  title?: string;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<{ open: boolean; supersedes?: DocumentRow }>({ open: false });

  const visible = documents.filter((doc) => (showArchived ? true : !doc.archived));

  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Ver versões anteriores
          </label>
          <Button size="sm" onClick={() => setForm({ open: true })}>
            <FilePlus2 className="mr-2 size-4" /> Novo documento
          </Button>
        </div>
      </div>

      {form.open ? (
        <DocumentForm
          suppliers={supplierOptions ?? suppliers}
          materials={materials}
          fixedSupplierId={fixedSupplierId}
          fixedMaterialId={fixedMaterialId}
          supplierRequired={supplierRequired}
          supersedes={form.supersedes}
          onClose={() => setForm({ open: false })}
        />
      ) : null}


      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sem documentação registada. Adicione fichas técnicas, certificações e declarações.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((doc) => (
            <DocumentRowItem
              key={doc.id}
              doc={doc}
              onNewVersion={() => setForm({ open: true, supersedes: doc })}
              suppliers={suppliers}
              materials={materials}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRowItem({
  doc,
  onNewVersion,
  suppliers,
  materials,
}: {
  doc: DocumentRow;
  onNewVersion: () => void;
  suppliers: { id: string; name: string }[];
  materials: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const supplierName = suppliers.find((s) => s.id === doc.supplier_id)?.name;
  const materialName = materials.find((m) => m.id === doc.raw_material_id)?.name;

  async function open() {
    setBusy(true);
    try {
      const { url } = await documentUrl({ data: { id: doc.id } });
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o ficheiro.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Eliminar "${doc.title}"?`)) return;
    setBusy(true);
    try {
      await deleteDocument({ data: { id: doc.id } });
      await queryClient.invalidateQueries();
      toast.success("Documento eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 py-3 ${doc.archived ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {doc.title} <span className="text-xs font-normal text-muted-foreground">v{doc.version}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {tipoDocumentoLabel(doc.doc_type)}
          {supplierName ? ` · ${supplierName}` : ""}
          {materialName ? ` · ${materialName}` : ""}
          {doc.issued_on ? ` · emitido ${formatDate(doc.issued_on)}` : ""}
          {doc.expires_on ? ` · válido até ${formatDate(doc.expires_on)}` : ""}
          {doc.uploaded_by ? ` · ${doc.uploaded_by}` : ""}
          {doc.archived ? " · versão anterior" : ""}
        </p>
      </div>
      <ValidityBadge expiresOn={doc.expires_on} />
      <div className="flex gap-1">
        {doc.storage_path ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void open()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          </Button>
        ) : null}
        {!doc.archived ? (
          <Button size="sm" variant="ghost" onClick={onNewVersion}>
            Nova versão
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function DocumentForm({
  suppliers,
  materials,
  fixedSupplierId,
  fixedMaterialId,
  supersedes,
  onClose,
}: {
  suppliers: { id: string; name: string }[];
  materials: { id: string; name: string }[];
  fixedSupplierId?: string | undefined;
  fixedMaterialId?: string | undefined;
  supersedes?: DocumentRow | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState(fixedSupplierId ?? supersedes?.supplier_id ?? "");
  const [materialId, setMaterialId] = useState(fixedMaterialId ?? supersedes?.raw_material_id ?? "");
  const [docType, setDocType] = useState(supersedes?.doc_type ?? "ficha_tecnica");
  const [docTitle, setDocTitle] = useState(supersedes?.title ?? "");
  const [version, setVersion] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function submit() {
    if (!docTitle.trim() || !version.trim()) {
      toast.error("Indique o título e a versão do documento.");
      return;
    }
    if (!supplierId && !materialId) {
      toast.error("Associe o documento a um fornecedor ou a uma matéria-prima.");
      return;
    }
    if (file && file.size > MAX_MB * 1024 * 1024) {
      toast.error(`O ficheiro excede ${MAX_MB} MB.`);
      return;
    }
    setSaving(true);
    try {
      await saveDocument({
        data: {
          supplierId: supplierId || null,
          materialId: materialId || null,
          doc_type: docType,
          title: docTitle.trim(),
          version: version.trim(),
          issued_on: issuedOn || null,
          expires_on: expiresOn || null,
          notes: notes.trim() || null,
          supersedesId: supersedes?.id ?? null,
          file: file ? await fileToBase64(file) : null,
        },
      });
      await queryClient.invalidateQueries();
      toast.success(supersedes ? "Nova versão registada." : "Documento registado.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar o documento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-secondary/40 p-4">
      <h3 className="mb-3 text-sm font-semibold">
        {supersedes ? `Nova versão de "${supersedes.title}"` : "Novo documento"}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        {!fixedSupplierId ? (
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sem fornecedor associado</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : null}
        {!fixedMaterialId ? (
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sem matéria-prima associada</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Título do documento" />
        <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Versão (ex.: 2026.1)" />
        <label className="text-xs text-muted-foreground">
          Data de emissão
          <Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground">
          Válido até
          <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground">
          Ficheiro (máx. {MAX_MB} MB)
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <Textarea className="mt-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" />
      <div className="mt-3 flex gap-2">
        <Button disabled={saving} onClick={() => void submit()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Guardar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
