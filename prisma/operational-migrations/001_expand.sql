-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "ConfigBalanca" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "ConfigSistema" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "CaixaSessao" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "ItensVenda" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "PagamentoVenda" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "MovimentacaoCaixa" ADD COLUMN "empresaId" TEXT;

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "empresaId" TEXT;
