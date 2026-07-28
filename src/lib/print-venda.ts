/** Abre o comprovante da venda em nova aba (mesma rota usada no PDV). */
export function openVendaPrint(vendaId: string): void {
  const url = `${window.location.origin}/print/venda/${vendaId}`;
  window.open(url, "_blank", "noopener=yes,noreferrer=yes");
}
