import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant-route";
import { CARGOS, tenantContext } from "@/lib/tenant-context";
export async function GET(req: Request) {
  return tenantRoute(req, CARGOS, async () =>
    NextResponse.json(tenantContext()),
  );
}
