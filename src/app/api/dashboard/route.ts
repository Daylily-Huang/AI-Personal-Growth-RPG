import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store/demo-db";
import { buildDashboardSnapshot } from "@/lib/store/dashboard.service";

export async function GET() {
  try {
    const dashboard = await buildDashboardSnapshot(getRepository());
    return NextResponse.json({ dashboard }, { status: 200 });
  } catch (error) {
    console.error("Failed to load dashboard", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
