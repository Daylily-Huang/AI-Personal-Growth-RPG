import { NextResponse } from "next/server";
import { getStrategyRepository } from "@/lib/strategy/request";
import { nonBlank, oneOf, onlyFields, optionalText, readStrategyBody, strategyErrorResponse, uuid } from "@/lib/strategy/http";
import type { StrategyStatus } from "@/lib/strategy/types";

const STATUSES: readonly StrategyStatus[] = ["HYPOTHESIS", "TESTING", "SUPPORTED", "CONTEXTUAL", "WEAKENED", "RETIRED"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repository = await getStrategyRepository();
    const id = uuid((await context.params).id, "strategyId");
    const body = await readStrategyBody(request);
    onlyFields(body, ["targetStatus", "contextBoundaryNote", "retirementReason", "requestIdempotencyKey"]);
    const result = await repository.transition(id, {
      targetStatus: oneOf(body.targetStatus, "targetStatus", STATUSES),
      contextBoundaryNote: optionalText(body.contextBoundaryNote, "contextBoundaryNote"),
      retirementReason: optionalText(body.retirementReason, "retirementReason"),
      requestIdempotencyKey: nonBlank(body.requestIdempotencyKey, "requestIdempotencyKey"),
    });
    return NextResponse.json(result);
  } catch (error) { return strategyErrorResponse(error, "Failed to transition strategy"); }
}
