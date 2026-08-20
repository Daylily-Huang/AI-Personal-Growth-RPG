import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { buildDashboardSnapshot } from "@/lib/store/dashboard.service";

export async function GET() {
  try {
    const repo = await getRequestRepository();
    const dashboard = await buildDashboardSnapshot(repo);
    return NextResponse.json({ dashboard }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to load dashboard", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
