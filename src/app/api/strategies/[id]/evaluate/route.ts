import { NextResponse } from "next/server";
import { getStrategyRepository } from "@/lib/strategy/request";
import { boolean, onlyFields, readStrategyBody, strategyErrorResponse, uuid } from "@/lib/strategy/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repository = await getStrategyRepository();
    const id = uuid((await context.params).id, "strategyId");
    const body = await readStrategyBody(request);
    onlyFields(body, ["confirmPromotion"]);
    const result = await repository.evaluate(id, body.confirmPromotion === undefined ? false : boolean(body.confirmPromotion, "confirmPromotion"));
    return NextResponse.json(result);
  } catch (error) { return strategyErrorResponse(error, "Failed to evaluate strategy"); }
}
