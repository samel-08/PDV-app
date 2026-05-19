const br = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Reutiliza formatador (menos alocação que criar Intl a cada chamada). */
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatBRL(value: number): string {
  return br.format(value);
}

/** Quantidade na venda (pode ser fracionada, ex.: kg). */
export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(rounded);
}

export function parseMoneyInput(raw: string): number {
  const n = Number(
    String(raw)
      .replace(/\s/g, "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
  return Number.isFinite(n) ? n : 0;
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return dateTimeFmt.format(date);
}

export function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const UNIDADE_LABEL: Record<string, string> = {
  KG: "Kg",
  UN: "Un",
  CX: "Cx",
  G: "g",
};

export function labelUnidadeMedida(u: string): string {
  return UNIDADE_LABEL[u] ?? u;
}
