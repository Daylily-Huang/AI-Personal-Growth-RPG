import { NextResponse } from "next/server";
import { optionalNullableString, phase8BErrorResponse, readJsonObject, requireNonBlankString, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    const season = await repo.cancelSeason(
      id,
      optionalNullableString(body.cancellationReason, "cancellationReason") ?? null,
      requireNonBlankString(body.requestIdempotencyKey, "requestIdempotencyKey"),
    );
    return NextResponse.json({ season }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to cancel season");
  }
}
