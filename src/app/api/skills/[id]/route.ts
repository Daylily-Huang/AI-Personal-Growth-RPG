import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import type { UpdateSkillMetadataInput } from "@/lib/store/types";
import { isValidUuid } from "@/lib/http/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    // 1. Authenticate first (P1-3)
    const repo = await getRequestRepository();

    // 2. Validate route param (P1-4)
    const { id } = await context.params;
    if (!id || !isValidUuid(id)) {
      return NextResponse.json({ error: "Valid skill UUID is required" }, { status: 400 });
    }

    // 3. Query detail read model
    const detail = await repo.getSkillDetails(id);

    if (!detail) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to get skill details", error);
    return NextResponse.json({ error: "Failed to get skill details" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate first (P1-3)
    const repo = await getRequestRepository();

    // 2. Validate route param (P1-4)
    const { id } = await context.params;
    if (!id || !isValidUuid(id)) {
      return NextResponse.json({ error: "Valid skill UUID is required" }, { status: 400 });
    }

    // 3. Parse JSON body (P1-3 / P1-4)
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const updates: UpdateSkillMetadataInput = {};

    if (b.name !== undefined) {
      if (typeof b.name !== "string" || b.name.trim() === "") {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = b.name.trim();
    }

    if (b.aliases !== undefined) {
      if (!Array.isArray(b.aliases) || b.aliases.some((a: unknown) => typeof a !== "string")) {
        return NextResponse.json({ error: "aliases must be an array of strings" }, { status: 400 });
      }
      updates.aliases = b.aliases.map((a: string) => a.trim()).filter(Boolean);
    }

    if (b.description !== undefined) {
      if (b.description !== null && typeof b.description !== "string") {
        return NextResponse.json({ error: "description must be a string or null" }, { status: 400 });
      }
      updates.description = b.description === null ? null : b.description.trim();
    }

    if (b.domainId !== undefined) {
      if (b.domainId !== null && !isValidUuid(b.domainId)) {
        return NextResponse.json({ error: "domainId must be a valid UUID or null" }, { status: 400 });
      }
      updates.domainId = b.domainId;
    }

    if (b.status !== undefined) {
      if (b.status !== "active" && b.status !== "archived") {
        return NextResponse.json({ error: "status must be 'active' or 'archived'" }, { status: 400 });
      }
      updates.status = b.status;
    }

    const updatedSkill = await repo.updateSkillMetadata(id, updates);
    return NextResponse.json(updatedSkill, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);

    if (message.includes("Skill not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message.includes("already exists") ||
      message.includes("duplicate") ||
      message.includes("normalized name") ||
      message.includes("23505")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (
      message.includes("does not exist") ||
      message.includes("foreign key") ||
      message.includes("23503") ||
      message.includes("domain")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Failed to update skill metadata", error);
    return NextResponse.json({ error: "Failed to update skill metadata" }, { status: 500 });
  }
}
