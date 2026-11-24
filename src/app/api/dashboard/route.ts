import { tenantRoute, MANAGERS } from "@/lib/tenant-route";
import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard-service";

export async function GET(req: Request) {
  return tenantRoute(req, MANAGERS, async () => {
    const data = await getDashboardData();
    return NextResponse.json(data);
  });
}

export const runtime = "nodejs";
