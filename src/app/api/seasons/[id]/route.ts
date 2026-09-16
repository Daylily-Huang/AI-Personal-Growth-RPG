import { NextResponse } from "next/server";
import { optionalNullableString, phase8BErrorResponse, readJsonObject, requireNonBlankString, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import { getPhase8BService } from "@/lib/outer-loop/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const service = await getPhase8BService();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "seasonId");
    const seasonContext = await service.getSeasonContext(id);
    if (!seasonContext) {
      return NextResponse.json({ error: "Season not found", code: "SEASON_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(seasonContext, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to load season");
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    const season = await repo.updateDraftMetadata(id, {
      name: requireNonBlankString(body.name, "name"),
      description: optionalNullableString(body.description, "description"),
      themeColor: optionalNullableString(body.themeColor, "themeColor"),
      iconKey: optionalNullableString(body.iconKey, "iconKey"),
    });
    return NextResponse.json({ season }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to update season");
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "seasonId");
    await repo.deleteUnactivated(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to delete season");
  }
}
