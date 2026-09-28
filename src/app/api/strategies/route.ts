import { NextResponse } from "next/server";
import { getStrategyRepository } from "@/lib/strategy/request";
import { getStrategyService } from "@/lib/strategy/service";
import { nonBlank, onlyFields, optionalText, readStrategyBody, strategyErrorResponse } from "@/lib/strategy/http";

export async function GET() {
  try {
    const strategies = await (await getStrategyService()).list();
    return NextResponse.json({ strategies, count: strategies.length });
  } catch (error) { return strategyErrorResponse(error, "Failed to list strategies"); }
}

export async function POST(request: Request) {
  try {
    const repository = await getStrategyRepository();
    const body = await readStrategyBody(request);
    onlyFields(body, ["title", "description", "contextTrigger", "actionProtocol", "expectedOutcome"]);
    const strategy = await repository.create({
      title: nonBlank(body.title, "title"), description: optionalText(body.description, "description"),
      contextTrigger: nonBlank(body.contextTrigger, "contextTrigger"),
      actionProtocol: nonBlank(body.actionProtocol, "actionProtocol"),
      expectedOutcome: nonBlank(body.expectedOutcome, "expectedOutcome"),
    });
    return NextResponse.json({ strategy }, { status: 201 });
  } catch (error) { return strategyErrorResponse(error, "Failed to create strategy"); }
}
