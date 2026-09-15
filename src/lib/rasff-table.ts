// Browser-side parser for structured RASFF Window exports (Excel/CSV).
// A structured export lets us group thousands of alerts by week without AI.

export type StructuredAlert = {
  reference: string | null;
  product: string;
  hazard: string | null;
  hazard_type: string | null;
  origin_country: string | null;
  manufacturer: string | null;
  notified_on: string | null;
  raw_text: string | null;
};

export type WeekBucket = {
  key: string;
  label: string;
  weekStart: string | null;
  alerts: StructuredAlert[];
};

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function toIsoDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const dmy = v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const ymd = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

function isoWeek(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const target = new Date(d);
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const monday = new Date(d);
  monday.setUTCDate(monday.getUTCDate() - ((d.getUTCDay() || 7) - 1));
  return { week, year: target.getUTCFullYear(), start: monday.toISOString().slice(0, 10) };
}

function hazardType(text: string): string | null {
  const t = text.toLowerCase();
  if (/(salmonella|listeria|e\.? coli|enterobacter|bacill|mould|bolor|yeast|norovirus|hepatit|clostrid|staphyl)/.test(t))
    return "microbiológico";
  if (/(allergen|alergen|gluten|milk|lactose|soy|sulphite|sulfito|peanut|amendoim|nut |undeclared)/.test(t))
    return "alergénio";
  if (/(aflatoxin|micotoxin|mycotoxin|ochratox|pesticid|ethylene oxide|oxido de etileno|metal|lead|cadmium|mercur|arsen|residue|dioxin|acrylamid|migration|additive|colour|nitrofur|toxin)/.test(t))
    return "químico";
  if (/(foreign body|corpo estranho|glass|plastic|metal fragment|insect)/.test(t)) return "corpo estranho";
  if (/(fraud|adulterat|substitution|mislabel)/.test(t)) return "fraude";
  if (/(radiation|radioactiv|caesium)/.test(t)) return "radiação";
  return "outro";
}

/** "Aflatoxin in Dried Figs from Turkey" -> hazard / product / origin */
function splitSubject(subject: string) {
  const clean = subject.replace(/\s+/g, " ").trim();
  let hazard: string | null = null;
  let rest = clean;
  const inMatch = clean.match(/^(.*?)\s+in\s+(.*)$/i);
  if (inMatch?.[1] && inMatch[2]) {
    hazard = inMatch[1].trim();
    rest = inMatch[2].trim();
  }
  let origin: string | null = null;
  const fromMatch = rest.match(/^(.*?)\s+from\s+(.*)$/i);
  if (fromMatch?.[1] && fromMatch[2]) {
    rest = fromMatch[1].trim();
    origin = fromMatch[2].split(/\s+through\s+|\s+via\s+/i)[0]?.trim() ?? null;
  }
  return { hazard, product: rest || clean, origin };
}

export function parseStructuredAlerts(rows: Record<string, string>[]): StructuredAlert[] {
  const alerts: StructuredAlert[] = [];
  for (const row of rows) {
    const subject = pick(row, ["subject", "assunto", "product", "produto", "descricao", "description"]);
    if (!subject || subject.length < 4) continue;
    const parts = splitSubject(subject);
    const category = pick(row, ["category", "categoria"]);
    const notified = toIsoDate(pick(row, ["date", "data", "notified_on", "notification date"]));
    const extra = [
      category ? `Categoria: ${category}` : "",
      pick(row, ["type", "tipo"]) ? `Tipo: ${pick(row, ["type", "tipo"])}` : "",
      pick(row, ["classification", "classificacao"]) ? `Classificação: ${pick(row, ["classification", "classificacao"])}` : "",
      pick(row, ["risk_decision", "risco"]) ? `Decisão de risco: ${pick(row, ["risk_decision", "risco"])}` : "",
      pick(row, ["notifying_country"]) ? `País notificante: ${pick(row, ["notifying_country"])}` : "",
      pick(row, ["hyperlink", "link", "url"]),
      subject,
    ]
      .filter(Boolean)
      .join(" · ");

    alerts.push({
      reference: pick(row, ["reference", "referencia", "ref"]) || null,
      product: parts.product,
      hazard: parts.hazard,
      hazard_type: hazardType(subject),
      origin_country: parts.origin,
      manufacturer: pick(row, ["manufacturer", "operator", "fabricante", "fornecedor"]) || null,
      notified_on: notified,
      raw_text: extra || null,
    });
  }
  return alerts;
}

export function looksStructured(rows: Record<string, string>[]) {
  const first = rows[0];
  if (!first) return false;
  const keys = Object.keys(first);
  const hasSubject = keys.some((k) => ["subject", "assunto", "produto", "product"].includes(k));
  const hasDateOrWeek = keys.some((k) => ["date", "data", "semana", "week"].includes(k));
  return hasSubject && hasDateOrWeek && rows.length > 5;
}

/** Group rows into weeks, using the sheet's own week column when present. */
export function groupRowsByWeek(rows: Record<string, string>[]): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>();
  for (const row of rows) {
    const alert = parseStructuredAlerts([row])[0];
    if (!alert) continue;

    let key: string;
    let label: string;
    let weekStart: string | null = null;

    if (alert.notified_on) {
      const { week, year, start } = isoWeek(alert.notified_on);
      key = `${year}-${String(week).padStart(2, "0")}`;
      label = `Semana ${String(week).padStart(2, "0")}/${year}`;
      weekStart = start;
    } else {
      const raw = pick(row, ["semana", "week"]);
      const num = raw ? Math.round(Number(raw.replace(",", "."))) : NaN;
      if (Number.isFinite(num) && num > 0) {
        key = `sem-${String(num).padStart(2, "0")}`;
        label = `Semana ${String(num).padStart(2, "0")}`;
      } else {
        key = "sem-data";
        label = "Alertas sem data";
      }
    }

    const bucket = buckets.get(key) ?? { key, label, weekStart, alerts: [] };
    bucket.alerts.push(alert);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}
