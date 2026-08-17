import { NextResponse } from "next/server";
import { createActivity } from "@/lib/store/demo-db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawInput = typeof body?.rawInput === "string" ? body.rawInput.trim() : "";

    if (!rawInput) {
      return NextResponse.json({ error: "rawInput is required" }, { status: 400 });
    }

    const activity = createActivity({
      rawInput,
      totalMinutes: typeof body?.totalMinutes === "number" ? body.totalMinutes : null,
      effectiveMinutes: typeof body?.effectiveMinutes === "number" ? body.effectiveMinutes : null,
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("Failed to create activity", error);
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }
}
