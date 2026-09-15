/** Constantes de domínio partilhadas (cliente e servidor). */

export const ALERGENIOS = [
  { id: "gluten", label: "Cereais com glúten", abrev: "GLU" },
  { id: "crustaceos", label: "Crustáceos", abrev: "CRU" },
  { id: "ovos", label: "Ovos", abrev: "OVO" },
  { id: "peixe", label: "Peixe", abrev: "PEI" },
  { id: "amendoins", label: "Amendoins", abrev: "AME" },
  { id: "soja", label: "Soja", abrev: "SOJ" },
  { id: "leite", label: "Leite", abrev: "LEI" },
  { id: "frutos_casca_rija", label: "Frutos de casca rija", abrev: "FCR" },
  { id: "aipo", label: "Aipo", abrev: "AIP" },
  { id: "mostarda", label: "Mostarda", abrev: "MOS" },
  { id: "sesamo", label: "Sementes de sésamo", abrev: "SES" },
  { id: "sulfitos", label: "Dióxido de enxofre e sulfitos", abrev: "SUL" },
  { id: "tremoco", label: "Tremoço", abrev: "TRE" },
  { id: "moluscos", label: "Moluscos", abrev: "MOL" },
] as const;

export type AlergenioId = (typeof ALERGENIOS)[number]["id"];

/** Alergénios com maior severidade de reação: sinalizados de forma destacada. */
export const ALERGENIOS_CRITICOS: AlergenioId[] = [
  "gluten",
  "amendoins",
  "frutos_casca_rija",
  "leite",
  "ovos",
  "sesamo",
  "soja",
];

export function alergenioLabel(id: string): string {
  return ALERGENIOS.find((a) => a.id === id)?.label ?? id;
}

export function alergenioAbrev(id: string): string {
  return ALERGENIOS.find((a) => a.id === id)?.abrev ?? id.slice(0, 3).toUpperCase();
}

export const ESTADOS_MP_FABRICA = [
  { id: "ativa", label: "Ativa" },
  { id: "para_testes", label: "Para testes" },
  { id: "inativa", label: "Inativa" },
] as const;

export type EstadoMpFabrica = (typeof ESTADOS_MP_FABRICA)[number]["id"];

export const TIPOS_DOCUMENTO = [
  { id: "ficha_tecnica", label: "Ficha técnica" },
  { id: "certificacao_brc", label: "Certificação BRC" },
  { id: "certificacao_ifs", label: "Certificação IFS" },
  { id: "certificacao_fssc", label: "Certificação FSSC 22000" },
  { id: "certificacao_iso", label: "Certificação ISO" },
  { id: "certificacao_aocs", label: "Certificação AOCS" },
  { id: "declaracao_alergenios", label: "Declaração de alergénios" },
  { id: "declaracao_ogm", label: "Declaração OGM" },
  { id: "declaracao_halal", label: "Declaração Halal" },
  { id: "declaracao_kosher", label: "Declaração Kosher" },
  { id: "analise_laboratorial", label: "Análise laboratorial" },
  { id: "auditoria_fornecedor", label: "Auditoria a fornecedor" },
  { id: "outro", label: "Outro" },
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]["id"];

export function tipoDocumentoLabel(id: string): string {
  return TIPOS_DOCUMENTO.find((t) => t.id === id)?.label ?? id;
}

export const ESTADOS_COMPLETUDE = [
  { id: "completo", label: "Completo" },
  { id: "pendente", label: "Pendente" },
  { id: "incompleto", label: "Incompleto" },
] as const;

export type ValidityState = "sem_validade" | "valido" | "expira_60" | "expira_30" | "expirado";

/** Semáforo de validade documental usado em toda a aplicação. */
export function validityState(expiresOn: string | null | undefined): ValidityState {
  if (!expiresOn) return "sem_validade";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${expiresOn}T00:00:00`);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expirado";
  if (days <= 30) return "expira_30";
  if (days <= 60) return "expira_60";
  return "valido";
}

export const VALIDITY_LABEL: Record<ValidityState, string> = {
  sem_validade: "Sem validade",
  valido: "Válido",
  expira_60: "Expira em 60 dias",
  expira_30: "Expira em 30 dias",
  expirado: "Expirado",
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-PT");
}
