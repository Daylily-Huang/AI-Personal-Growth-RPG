import { NextResponse } from "next/server";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import { getPhase8BService } from "@/lib/outer-loop/service";
import { optionalNullableString, phase8BErrorResponse, readJsonObject, requireNonBlankString } from "@/lib/outer-loop/http";

export async function GET() {
  try {
    const service = await getPhase8BService();
    const seasons = await service.listSeasonSummaries();
    return NextResponse.json({ seasons, count: seasons.length }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to list seasons");
  }
}

export async function POST(request: Request) {
  try {
    const repo = await getPhase8BRepository();
    const body = await readJsonObject(request);
    const season = await repo.createDraft({
      name: requireNonBlankString(body.name, "name"),
      description: optionalNullableString(body.description, "description"),
      themeColor: optionalNullableString(body.themeColor, "themeColor"),
      iconKey: optionalNullableString(body.iconKey, "iconKey"),
    });
    return NextResponse.json({ season }, { status: 201 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to create season");
  }
}
