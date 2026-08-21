import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { detectQuestCycle, syncParentQuestProgress } from "@/lib/store/quest.service";
import type { UpdateQuestInput } from "@/lib/store/types";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const repo = await getRequestRepository();
    const quest = await repo.getQuest(id);

    if (!quest) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 });
    }

    return NextResponse.json({ quest }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to get quest", error);
    return NextResponse.json({ error: "Failed to get quest" }, { status: 500 });
  }
}

const VALID_QUEST_TYPES = ["learning", "skill", "production", "physical", "maintenance", "reflection"];
const VALID_QUEST_SIZES = ["micro", "minor", "standard", "major", "epic", "main"];
const VALID_QUEST_STATUSES = ["locked", "available", "active", "paused", "completed", "failed", "archived"];

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const body = await request.json();

    const repo = await getRequestRepository();
    const existing = await repo.getQuest(id);
    if (!existing) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 });
    }

    if (body.questType !== undefined && !VALID_QUEST_TYPES.includes(body.questType)) {
      return NextResponse.json({ error: `questType must be one of: ${VALID_QUEST_TYPES.join(", ")}` }, { status: 400 });
    }
    if (body.questSize !== undefined && !VALID_QUEST_SIZES.includes(body.questSize)) {
      return NextResponse.json({ error: `questSize must be one of: ${VALID_QUEST_SIZES.join(", ")}` }, { status: 400 });
    }
    if (body.status !== undefined && !VALID_QUEST_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_QUEST_STATUSES.join(", ")}` }, { status: 400 });
    }
    if (body.difficulty !== undefined && (typeof body.difficulty !== "number" || body.difficulty < 0 || body.difficulty > 1)) {
      return NextResponse.json({ error: "difficulty must be a number between 0 and 1" }, { status: 400 });
    }
    if (body.goalAlignment !== undefined && (typeof body.goalAlignment !== "number" || body.goalAlignment < 0 || body.goalAlignment > 1)) {
      return NextResponse.json({ error: "goalAlignment must be a number between 0 and 1" }, { status: 400 });
    }
    if (body.progress !== undefined && (typeof body.progress !== "number" || body.progress < 0 || body.progress > 100)) {
      return NextResponse.json({ error: "progress must be a number between 0 and 100" }, { status: 400 });
    }

    if (body.parentQuestId !== undefined && body.parentQuestId !== null) {
      if (body.parentQuestId === id) {
        return NextResponse.json(
          { error: "Self-parenting is forbidden: quest cannot be its own parent" },
          { status: 400 },
        );
      }
      const allQuests = await repo.listQuests();
      if (detectQuestCycle(allQuests, id, body.parentQuestId)) {
        return NextResponse.json(
          { error: "Cycle detected: cannot set parent_quest_id to a descendant quest" },
          { status: 400 },
        );
      }
    }

    const updates: UpdateQuestInput = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.questType !== undefined) updates.questType = body.questType;
    if (body.questSize !== undefined) updates.questSize = body.questSize;
    if (body.status !== undefined) updates.status = body.status;
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty;
    if (body.goalAlignment !== undefined) updates.goalAlignment = body.goalAlignment;
    if (body.progress !== undefined) updates.progress = body.progress;
    if (body.deadline !== undefined) updates.deadline = body.deadline;
    if (body.isMainQuest !== undefined) updates.isMainQuest = body.isMainQuest;
    if (body.isBoss !== undefined) updates.isBoss = body.isBoss;
    if (body.parentQuestId !== undefined) updates.parentQuestId = body.parentQuestId;

    const updated = await repo.updateQuest(id, updates);

    // Sync progress on both old parent and new parent (Round26 P1-3)
    if (existing.parentQuestId && existing.parentQuestId !== updated.parentQuestId) {
      await syncParentQuestProgress(repo, existing.parentQuestId);
    }
    if (updated.parentQuestId) {
      await syncParentQuestProgress(repo, updated.parentQuestId);
    }

    return NextResponse.json({ quest: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "";
    if (message.includes("Cycle detected") || message.includes("Self-parenting") || message.includes("UNIQUE_ACTIVE_MAIN_QUEST") || message.includes("unique_active_main_quest")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Failed to update quest", error);
    return NextResponse.json({ error: "Failed to update quest" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const repo = await getRequestRepository();
    const existing = await repo.getQuest(id);
    if (!existing) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 });
    }

    await repo.deleteQuest(id);
    if (existing.parentQuestId) {
      await syncParentQuestProgress(repo, existing.parentQuestId);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to delete quest", error);
    return NextResponse.json({ error: "Failed to delete quest" }, { status: 500 });
  }
}
