import { NextResponse } from "next/server";
import { getStrategyReadContext, listStrategySources } from "@/lib/strategy/discovery";
import { oneOf, strategyErrorResponse, uuid } from "@/lib/strategy/http";
import type { StrategySourceClass } from "@/lib/strategy/types";

const SOURCES: readonly StrategySourceClass[] = [
  "SEASON_REVIEW", "ACTIVITY", "QUEST_OUTCOME", "ARTIFACT",
  "CORE_EVIDENCE_REFERENCE", "JOURNAL_CONTEXT", "MANUAL_OBSERVATION",
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sourceClass = oneOf(url.searchParams.get("sourceClass"), "sourceClass", SOURCES);
    const rawId = url.searchParams.get("id");
    const id = rawId === null ? undefined : uuid(rawId, "id");
    const { db, userId } = await getStrategyReadContext();
    const sources = await listStrategySources(db, userId, sourceClass, id);
    return NextResponse.json({ sources, count: sources.length });
  } catch (error) { return strategyErrorResponse(error, "Failed to list strategy sources"); }
}
