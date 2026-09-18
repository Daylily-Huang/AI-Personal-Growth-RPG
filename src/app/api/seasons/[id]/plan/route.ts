import { NextResponse } from "next/server";
import { phase8BErrorResponse, readJsonObject, requireNonBlankString, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    const duration = body.targetDurationDays;
    if (!Number.isInteger(duration) || Number(duration) < 14 || Number(duration) > 84) {
      return NextResponse.json({ error: "targetDurationDays must be an integer between 14 and 84", code: "INVALID_DURATION" }, { status: 400 });
    }
    if (!Array.isArray(body.successCriteria)) {
      return NextResponse.json({ error: "successCriteria must be an array", code: "INVALID_SUCCESS_CRITERIA" }, { status: 400 });
    }
    const season = await repo.planSeason(id, {
      plannedStartDate: requireNonBlankString(body.plannedStartDate, "plannedStartDate"),
      targetDurationDays: Number(duration),
      successCriteria: body.successCriteria,
      requestIdempotencyKey: requireNonBlankString(body.requestIdempotencyKey, "requestIdempotencyKey"),
    });
    return NextResponse.json({ season }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to plan season");
  }
}
