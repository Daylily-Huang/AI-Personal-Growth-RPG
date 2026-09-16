import { NextResponse } from "next/server";
import { phase8BErrorResponse, readJsonObject, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import type { SeasonQuestRole } from "@/lib/outer-loop/types";

const ROLES: SeasonQuestRole[] = ["MAIN", "FOCUS"];

function requireRole(value: unknown): SeasonQuestRole {
  if (typeof value !== "string" || !ROLES.includes(value as SeasonQuestRole)) {
    throw new Error("INVALID_SEASON_QUEST_ROLE");
  }
  return value as SeasonQuestRole;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const seasonId = requireUuid(rawId, "seasonId");
    const links = await repo.listLinks(seasonId);
    return NextResponse.json({ links, count: links.length }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to list season quests");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const seasonId = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    const link = await repo.linkQuest(seasonId, requireUuid(body.questId, "questId"), requireRole(body.role));
    return NextResponse.json({ link }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to link season quest");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const seasonId = requireUuid(rawId, "seasonId");
    const body = await readJsonObject(request);
    await repo.unlinkQuest(seasonId, requireUuid(body.questId, "questId"), requireRole(body.role));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to unlink season quest");
  }
}
