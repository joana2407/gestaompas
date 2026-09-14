// Browser-side extraction of readable text / rows from uploaded files.

export type InventoryRow = Record<string, string>;

function normalizeKey(key: string) {
  return key
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function readSpreadsheetRows(file: File): Promise<InventoryRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const rows: InventoryRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    for (const row of json) {
      const clean: InventoryRow = {};
      for (const [key, value] of Object.entries(row)) {
        clean[normalizeKey(key)] = value == null ? "" : String(value).trim();
      }
      clean["__sheet"] = sheetName;
      if (Object.values(clean).some((v) => v && v !== sheetName)) rows.push(clean);
    }
  }
  return rows;
}

export async function readSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const csv = sheet ? XLSX.utils.sheet_to_csv(sheet) : "";
    return `## Folha: ${name}\n${csv}`;
  }).join("\n\n");
}

export async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ");
    pages.push(`--- Página ${i} ---\n${text}`);
  }
  return pages.join("\n\n");
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return readPdfText(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm")) {
    return readSpreadsheetText(file);
  }
  return file.text();
}
