// Leitura do ficheiro "Avaliação de riscos MP e ME": cada aba corresponde a uma MP.

export type ParsedIngredient = { name: string; origin: string | null };

export type ParsedMaterial = {
  code: string; // nome da aba
  name: string;
  category: string | null;
  kind: "simples" | "composta";
  origins: string[];
  supplier: string | null;
  notes: string | null;
  ingredients: ParsedIngredient[];
};

const SKIP_SHEETS = [
  "sumario",
  "fraude",
  "critérios",
  "criterios",
  "rank+score",
  "rasff report",
  "avaliação fraude",
  "avaliacao fraude",
  "plano de acções",
  "plano de accoes",
  "plano de acçõesmp",
];

const COUNTRIES = [
  "portugal","espanha","frança","franca","alemanha","polónia","polonia","áustria","austria","itália","italia",
  "bélgica","belgica","holanda","países baixos","paises baixos","dinamarca","suécia","suecia","finlândia","finlandia",
  "reino unido","irlanda","turquia","ucrânia","ucrania","rússia","russia","brasil","argentina","chile","peru",
  "méxico","mexico","estados unidos","américa do norte","america do norte","eua","canadá","canada","china","índia",
  "india","vietname","tailândia","tailandia","indonésia","indonesia","marrocos","tunísia","tunisia","egito","egipto",
  "áfrica do sul","africa do sul","israel","irão","irao","républica checa","republica checa","hungria","roménia",
  "romenia","bulgária","bulgaria","grécia","grecia","suíça","suica","noruega","nova zelândia","nova zelandia",
  "austrália","australia","japão","japao","coreia","paquistão","paquistao","bolívia","bolivia","colômbia","colombia",
  "costa do marfim","gana","nigéria","nigeria","quénia","quenia","ue","união europeia","uniao europeia","extra-ue",
];

function clean(value: unknown): string {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function isCountry(text: string) {
  const t = text.toLowerCase().replace(/^origem( atual)?\s*:?\s*/, "").trim();
  return COUNTRIES.some((c) => t === c || t.includes(c));
}

function splitList(text: string): string[] {
  return text
    .replace(/^origem( atual)?\s*:?\s*/i, "")
    .split(/[,;\n/]|\se\s/gi)
    .map((part) => clean(part).replace(/\.$/, ""))
    .filter((part) => part.length > 1 && !/^n\.?a\.?$/i.test(part));
}

function shouldSkip(sheetName: string) {
  const n = sheetName.toLowerCase();
  return SKIP_SHEETS.some((s) => n.includes(s));
}

export async function parseInventoryWorkbook(file: File): Promise<ParsedMaterial[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const materials: ParsedMaterial[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (shouldSkip(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: true });

    const labelRow = grid.findIndex((row) =>
      clean(row?.[0]).toLowerCase().startsWith("identificação da matéria") ||
      clean(row?.[0]).toLowerCase().startsWith("identificacao da materia"),
    );
    if (labelRow < 0) continue;

    const nameRow = grid[labelRow] ?? [];
    const originRow = grid[labelRow + 1] ?? [];
    const ingredientRow = grid[labelRow + 2] ?? [];
    const ingredientLabel = clean(ingredientRow[0]).toLowerCase();

    let riskLevel: string | null = null;
    let supplier: string | null = null;
    for (let r = labelRow; r < Math.min(grid.length, labelRow + 12); r++) {
      for (const cell of grid[r] ?? []) {
        const text = clean(cell);
        if (!riskLevel && /risco$/i.test(text) && text.length < 40) riskLevel = text;
      }
      const maybeSupplier = clean((grid[r] ?? [])[11]);
      if (!supplier && maybeSupplier && !/fornecedor/i.test(maybeSupplier)) supplier = maybeSupplier;
    }

    // Uma aba pode conter várias MP em colunas diferentes (ex.: materiais de embalagem).
    const columns: number[] = [];
    for (let c = 1; c < Math.max(nameRow.length, 20); c++) {
      if (clean(nameRow[c]).length > 1) columns.push(c);
    }
    if (columns.length === 0) continue;

    for (const column of columns) {
      const name = clean(nameRow[column]);
      const originText = clean(originRow[column]) || clean(originRow[columns[0]]);
      const ingredientText = clean(ingredientRow[column]) || clean(ingredientRow[columns[0]]);

      const origins = splitList(originText).filter(Boolean);
      const ingredients: ParsedIngredient[] = [];
      const extraOrigins: string[] = [];

      if (ingredientText && !/^n\.?a\.?$/i.test(ingredientText) && !/origem/i.test(ingredientLabel + "x") === false) {
        for (const item of splitList(ingredientText)) {
          if (isCountry(item)) extraOrigins.push(item);
          else ingredients.push({ name: item, origin: null });
        }
      }

      const allOrigins = Array.from(new Set([...origins, ...extraOrigins].map((o) => o.replace(/^\w/, (m) => m.toUpperCase()))));
      const isMix = /mix|composto|premix|preparado/i.test(name) || ingredients.length > 1;

      materials.push({
        code: columns.length > 1 ? `${sheetName} · ${name}`.slice(0, 80) : sheetName,
        name,
        category: /embalagem/i.test(sheetName) ? "Material de embalagem" : null,
        kind: isMix ? "composta" : "simples",
        origins: allOrigins,
        supplier,
        notes: [
          riskLevel ? `Nível de risco interno: ${riskLevel}` : null,
          ingredientText && ingredients.length === 0 ? `Origem dos ingredientes: ${ingredientText}` : null,
        ]
          .filter(Boolean)
          .join(" | ") || null,
        ingredients,
      });
    }
  }

  return materials;
}
