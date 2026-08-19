import { NextResponse } from "next/server";
import { getRequestRepository } from "@/lib/store/request-repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawInput = typeof body?.rawInput === "string" ? body.rawInput.trim() : "";

    if (!rawInput) {
      return NextResponse.json({ error: "rawInput is required" }, { status: 400 });
    }

    const repo = await getRequestRepository();
    const activity = await repo.addActivity({
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
