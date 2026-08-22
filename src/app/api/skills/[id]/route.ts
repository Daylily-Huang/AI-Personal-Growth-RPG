import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import type { UpdateSkillMetadataInput } from "@/lib/store/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Skill ID is required" }, { status: 400 });
    }

    const repo = await getRequestRepository();
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
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Skill ID is required" }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updates: UpdateSkillMetadataInput = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.aliases !== undefined) {
      if (!Array.isArray(body.aliases) || body.aliases.some((a: unknown) => typeof a !== "string")) {
        return NextResponse.json({ error: "aliases must be an array of strings" }, { status: 400 });
      }
      updates.aliases = body.aliases.map((a: string) => a.trim()).filter(Boolean);
    }

    if (body.description !== undefined) {
      updates.description = body.description === null ? null : String(body.description).trim();
    }

    if (body.domainId !== undefined) {
      updates.domainId = body.domainId === null ? null : String(body.domainId);
    }

    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "archived") {
        return NextResponse.json({ error: "status must be 'active' or 'archived'" }, { status: 400 });
      }
      updates.status = body.status;
    }

    const repo = await getRequestRepository();
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

    if (message.includes("Skill not found") || message.includes("access denied")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message.includes("already exists") ||
      message.includes("duplicate") ||
      message.includes("normalized name")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (
      message.includes("cross-tenant") ||
      message.includes("foreign key") ||
      message.includes("violates")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Failed to update skill metadata", error);
    return NextResponse.json({ error: message || "Failed to update skill metadata" }, { status: 500 });
  }
}
