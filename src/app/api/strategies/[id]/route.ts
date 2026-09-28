import { NextResponse } from "next/server";
import { getStrategyRepository } from "@/lib/strategy/request";
import { getStrategyService } from "@/lib/strategy/service";
import { nonBlank, onlyFields, optionalText, readStrategyBody, StrategyHttpError, strategyErrorResponse, uuid } from "@/lib/strategy/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const service = await getStrategyService();
    const id = uuid((await context.params).id, "strategyId");
    const result = await service.getContext(id);
    if (!result) return NextResponse.json({ error: "Strategy not found", code: "STRATEGY_NOT_FOUND" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) { return strategyErrorResponse(error, "Failed to load strategy"); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const repository = await getStrategyRepository();
    const id = uuid((await context.params).id, "strategyId");
    const body = await readStrategyBody(request);
    onlyFields(body, ["title", "description"]);
    if (body.title === undefined && body.description === undefined) {
      throw new StrategyHttpError("At least one metadata field is required", 400, "INVALID_INPUT");
    }
    const changes = {
      ...(body.title === undefined ? {} : { title: nonBlank(body.title, "title") }),
      ...(body.description === undefined ? {} : { description: optionalText(body.description, "description") ?? "" }),
    };
    const strategy = await repository.updateMetadata(id, changes);
    if (!strategy) return NextResponse.json({ error: "Strategy not found", code: "STRATEGY_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ strategy });
  } catch (error) { return strategyErrorResponse(error, "Failed to update strategy"); }
}
