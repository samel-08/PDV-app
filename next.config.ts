import type { NextConfig } from "next";

/**
 * Otimizações para produção em hardware limitado (ex.: Lubuntu, 2 GB RAM):
 * - `output: "standalone"`: build mínimo para copiar só o necessário ao servidor.
 * - `optimizePackageImports`: tree-shaking mais agressivo em pacotes com muitos submódulos.
 * - `removeConsole`: menos I/O no runtime (mantém error/warn).
 * - `productionBrowserSourceMaps: false`: build mais rápido e bundle menor.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,
  output: "standalone",
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tanstack/react-query",
      "recharts",
    ],
  },
  serverExternalPackages: ["csv-parse"],
};

export default nextConfig;
