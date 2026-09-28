import { NextResponse } from "next/server";
import { getStrategyRepository } from "@/lib/strategy/request";
import { nonBlank, observedAt, oneOf, onlyFields, optionalText, readStrategyBody, strategyErrorResponse, uuid } from "@/lib/strategy/http";
import type { StrategyObservation, StrategySourceClass } from "@/lib/strategy/types";

type Context = { params: Promise<{ id: string }> };
const OBSERVATIONS: readonly StrategyObservation[] = ["SUPPORT", "COUNTER_EVIDENCE"];
const SOURCES: readonly StrategySourceClass[] = [
  "SEASON_REVIEW", "ACTIVITY", "QUEST_OUTCOME", "ARTIFACT", "CORE_EVIDENCE_REFERENCE",
  "JOURNAL_CONTEXT", "MANUAL_OBSERVATION",
];

export async function GET(_request: Request, context: Context) {
  try {
    const repository = await getStrategyRepository();
    const id = uuid((await context.params).id, "strategyId");
    if (!await repository.get(id)) return NextResponse.json({ error: "Strategy not found", code: "STRATEGY_NOT_FOUND" }, { status: 404 });
    const supports = await repository.listSupports(id);
    return NextResponse.json({ supports, count: supports.length });
  } catch (error) { return strategyErrorResponse(error, "Failed to list strategy supports"); }
}

export async function POST(request: Request, context: Context) {
  try {
    const repository = await getStrategyRepository();
    const id = uuid((await context.params).id, "strategyId");
    const body = await readStrategyBody(request);
    onlyFields(body, ["observationType", "sourceClass", "sourceId", "evaluatorVersion", "note", "observedAt"]);
    const result = await repository.insertSupport(id, {
      observationType: oneOf(body.observationType, "observationType", OBSERVATIONS),
      sourceClass: oneOf(body.sourceClass, "sourceClass", SOURCES),
      sourceId: uuid(body.sourceId, "sourceId"), evaluatorVersion: nonBlank(body.evaluatorVersion, "evaluatorVersion"),
      note: optionalText(body.note, "note"), observedAt: observedAt(body.observedAt),
    });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) { return strategyErrorResponse(error, "Failed to log strategy support"); }
}
