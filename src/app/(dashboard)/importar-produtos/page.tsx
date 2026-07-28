import { redirect } from "next/navigation";

/** CSV e importações legadas ficam em Importar tabela. */
export default function ImportarProdutosRedirectPage() {
  redirect("/importar-tabela");
}
