import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { buildQuestTree } from "@/lib/store/quest.service";
import type { NewQuestInput, QuestStatus, QuestType, QuestSize } from "@/lib/store/types";

const VALID_QUEST_TYPES: QuestType[] = [
  "learning",
  "skill",
  "production",
  "physical",
  "maintenance",
  "reflection",
];

const VALID_QUEST_SIZES: QuestSize[] = [
  "micro",
  "minor",
  "standard",
  "major",
  "epic",
  "main",
];

const VALID_QUEST_STATUSES: QuestStatus[] = [
  "locked",
  "available",
  "active",
  "paused",
  "completed",
  "failed",
  "archived",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as QuestStatus | null;
    const isMainParam = searchParams.get("is_main");
    const treeParam = searchParams.get("tree") === "true";

    const filter: { status?: QuestStatus; isMain?: boolean } = {};
    if (statusParam && VALID_QUEST_STATUSES.includes(statusParam)) {
      filter.status = statusParam;
    }
    if (isMainParam !== null) {
      filter.isMain = isMainParam === "true";
    }

    const repo = await getRequestRepository();
    const quests = await repo.listQuests(filter);

    if (treeParam) {
      const tree = buildQuestTree(quests);
      return NextResponse.json({ tree, count: quests.length }, { status: 200 });
    }

    return NextResponse.json({ quests, count: quests.length }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to list quests", error);
    return NextResponse.json({ error: "Failed to list quests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const questType = body?.questType as QuestType;
    if (!questType || !VALID_QUEST_TYPES.includes(questType)) {
      return NextResponse.json(
        { error: `questType must be one of: ${VALID_QUEST_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const questSize = body?.questSize as QuestSize | undefined;
    if (questSize && !VALID_QUEST_SIZES.includes(questSize)) {
      return NextResponse.json(
        { error: `questSize must be one of: ${VALID_QUEST_SIZES.join(", ")}` },
        { status: 400 },
      );
    }

    const status = body?.status as QuestStatus | undefined;
    if (status && !VALID_QUEST_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_QUEST_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const input: NewQuestInput = {
      parentQuestId: body?.parentQuestId || null,
      title,
      description: typeof body?.description === "string" ? body.description.trim() : null,
      questType,
      questSize: questSize ?? (body?.isMainQuest ? "main" : "standard"),
      status: status ?? "available",
      difficulty: typeof body?.difficulty === "number" ? Math.max(0, Math.min(1, body.difficulty)) : 0.5,
      goalAlignment: typeof body?.goalAlignment === "number" ? Math.max(0, Math.min(1, body.goalAlignment)) : 0.5,
      progress: typeof body?.progress === "number" ? Math.max(0, Math.min(100, body.progress)) : 0,
      deadline: typeof body?.deadline === "string" ? body.deadline : null,
      isMainQuest: Boolean(body?.isMainQuest),
      isBoss: Boolean(body?.isBoss),
    };

    const repo = await getRequestRepository();
    const quest = await repo.addQuest(input);

    return NextResponse.json({ quest }, { status: 201 });
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
    if (message.includes("Cycle detected") || message.includes("Self-parenting") || message.includes("violates foreign key") || message.includes("UNIQUE_ACTIVE_MAIN_QUEST") || message.includes("unique_active_main_quest")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Failed to create quest", error);
    return NextResponse.json({ error: "Failed to create quest" }, { status: 500 });
  }
}
