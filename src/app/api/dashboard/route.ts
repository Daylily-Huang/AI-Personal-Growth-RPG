import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/store/demo-db";

export async function GET() {
  try {
    return NextResponse.json({ dashboard: getDashboard() }, { status: 200 });
  } catch (error) {
    console.error("Failed to load dashboard", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
