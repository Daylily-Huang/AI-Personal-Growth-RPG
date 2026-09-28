import { NextResponse } from "next/server";
import { getStrategyRepository } from "@/lib/strategy/request";
import { nonBlank, onlyFields, optionalText, readStrategyBody, strategyErrorResponse, uuid } from "@/lib/strategy/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const repository = await getStrategyRepository();
    const id = uuid((await context.params).id, "strategyId");
    if (!await repository.get(id)) return NextResponse.json({ error: "Strategy not found", code: "STRATEGY_NOT_FOUND" }, { status: 404 });
    const versions = await repository.listVersions(id);
    return NextResponse.json({ versions, count: versions.length });
  } catch (error) { return strategyErrorResponse(error, "Failed to list strategy versions"); }
}

export async function POST(request: Request, context: Context) {
  try {
    const repository = await getStrategyRepository();
    const id = uuid((await context.params).id, "strategyId");
    const body = await readStrategyBody(request);
    onlyFields(body, ["actionProtocol", "contextTrigger", "expectedOutcome", "changeSummary", "requestIdempotencyKey"]);
    const result = await repository.createVersion(id, {
      actionProtocol: nonBlank(body.actionProtocol, "actionProtocol"),
      contextTrigger: nonBlank(body.contextTrigger, "contextTrigger"),
      expectedOutcome: nonBlank(body.expectedOutcome, "expectedOutcome"),
      changeSummary: optionalText(body.changeSummary, "changeSummary"),
      requestIdempotencyKey: nonBlank(body.requestIdempotencyKey, "requestIdempotencyKey"),
    });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) { return strategyErrorResponse(error, "Failed to create strategy version"); }
}
