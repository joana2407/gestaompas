
type SupplierLink = {
  id: string;
  supplier_id: string;
  supplier_reference: string | null;
  origin_country: string | null;
  shelf_life_months: number | null;
  preferred: boolean;
  active?: boolean;
  suppliers: { id: string; name: string; code: string | null; status: string } | null;
};

function SupplierLinkRow({
  materialId,
  link,
  onRemove,
}: {
  materialId: string;
  link: SupplierLink;
  onRemove: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    reference: link.supplier_reference ?? "",
    origin: link.origin_country ?? "",
    shelfLife: link.shelf_life_months ? String(link.shelf_life_months) : "",
    preferred: link.preferred,
    active: link.active ?? true,
  });

  async function save() {
    setSaving(true);
    try {
      await updateMaterialSupplierLink({
        data: {
          id: link.id,
          materialId,
          supplier_reference: form.reference.trim() || null,
          origin_country: form.origin.trim() || null,
          shelf_life_months: form.shelfLife ? Number(form.shelfLife) : null,
          preferred: form.preferred,
          active: form.active,
        },
      });
      await queryClient.invalidateQueries();
      setEditing(false);
      toast.success("Fornecedor atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to="/fornecedor/$supplierId"
            params={{ supplierId: link.supplier_id }}
            className="text-sm font-semibold hover:underline"
          >
            {link.suppliers?.name ?? "Fornecedor"}
          </Link>
          <p className="text-xs text-muted-foreground">
            {link.supplier_reference ? `Ref. ${link.supplier_reference}` : "sem referência"}
            {link.origin_country ? ` · origem ${link.origin_country}` : ""}
            {link.shelf_life_months ? ` · validade ${link.shelf_life_months} meses` : ""}
            {link.active === false ? " · inativo" : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            link.preferred ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Star className="size-3.5" /> {link.preferred ? "Preferencial" : "Secundário"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? "Fechar" : "Editar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {editing ? (
        <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3">
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Referência do fornecedor"
            />
            <Input
              value={form.origin}
              onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
              placeholder="País de origem"
            />
            <Input
              value={form.shelfLife}
              onChange={(e) => setForm((f) => ({ ...f, shelfLife: e.target.value.replace(/\D/g, "") }))}
              placeholder="Validade (meses)"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.preferred}
                onChange={(e) => setForm((f) => ({ ...f, preferred: e.target.checked }))}
              />
              Fornecedor preferencial
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Ativo
            </label>
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
