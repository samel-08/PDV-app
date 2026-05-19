import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

/** `display: "swap"` evita texto invisível por muito tempo em CPU/rede lentos. */
const inter = Inter({ subsets: ["latin"], display: "swap", adjustFontFallback: true });

export const metadata: Metadata = {
  title: "PDV Comércio",
  description: "Sistema de ponto de venda para pequeno e médio comércio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} min-h-dvh`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
