import { NextResponse } from "next/server";
import { getStrategyReadContext, listStrategyProposals } from "@/lib/strategy/discovery";
import { strategyErrorResponse } from "@/lib/strategy/http";

export async function GET() {
  try {
    const { db, userId } = await getStrategyReadContext();
    const proposals = await listStrategyProposals(db, userId);
    return NextResponse.json({ proposals, count: proposals.length });
  } catch (error) { return strategyErrorResponse(error, "Failed to list strategy proposals"); }
}
