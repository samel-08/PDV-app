export const FUSO_RELATORIO = "America/Sao_Paulo";
const diaMs = 86_400_000;
const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_RELATORIO, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", hourCycle: "h23",
});

export function diaNoFuso(data: Date): string {
  const parts = Object.fromEntries(formato.formatToParts(data).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dataValida(dia: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) && Number.isFinite(Date.parse(`${dia}T00:00:00Z`)) &&
    new Date(`${dia}T00:00:00Z`).toISOString().slice(0, 10) === dia;
}

export function periodoHorarios(inicio: string, fim: string) {
  if (!dataValida(inicio) || !dataValida(fim)) throw new Error("Informe datas válidas.");
  const primeiro = Date.parse(`${inicio}T00:00:00Z`);
  const ultimo = Date.parse(`${fim}T00:00:00Z`);
  if (ultimo < primeiro || ultimo - primeiro > 92 * diaMs) throw new Error("Escolha um período de 1 a 93 dias.");
  // Leitura com folga para fusos/DST; a agregação aplica os dias locais exatos.
  return { gte: new Date(primeiro - diaMs), lt: new Date(ultimo + 2 * diaMs) };
}

export function agregarHorarios(vendas: { createdAt: Date; total: number }[], inicio: string, fim: string) {
  const horarios = Array.from({ length: 24 }, (_, hora) => ({
    hora, faixa: `${String(hora).padStart(2, "0")}h–${String(hora).padStart(2, "0")}h59`,
    quantidade: 0, total: 0,
  }));
  const centavos = Array<number>(24).fill(0);
  for (const venda of vendas) {
    const dia = diaNoFuso(venda.createdAt);
    if (dia < inicio || dia > fim) continue;
    const hora = Number(formato.formatToParts(venda.createdAt).find(p => p.type === "hour")!.value);
    horarios[hora].quantidade++;
    centavos[hora] += Math.round(venda.total * 100);
  }
  for (const linha of horarios) linha.total = centavos[linha.hora] / 100;
  const maiorQuantidade = Math.max(...horarios.map(h => h.quantidade));
  return {
    inicio, fim, fuso: FUSO_RELATORIO, horarios,
    totalVendas: horarios.reduce((s, h) => s + h.quantidade, 0),
    totalVendido: centavos.reduce((s, c) => s + c, 0) / 100,
    picos: maiorQuantidade ? horarios.filter(h => h.quantidade === maiorQuantidade).map(h => h.hora) : [],
  };
}

export type RelatorioHorarios = ReturnType<typeof agregarHorarios>;
