import { NextResponse } from "next/server";
import { phase8BErrorResponse } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";

export async function GET() {
  try {
    const repo = await getPhase8BRepository();
    const reviews = await repo.listReviews();
    return NextResponse.json({ reviews, count: reviews.length }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to list reviews");
  }
}
