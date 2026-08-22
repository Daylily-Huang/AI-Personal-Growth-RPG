import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val);
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    // 1. Authenticate first (P1-3)
    const repo = await getRequestRepository();

    // 2. Validate route param (P1-4)
    const { id } = await context.params;
    if (!id || !isValidUuid(id)) {
      return NextResponse.json({ error: "Valid edge UUID is required" }, { status: 400 });
    }

    // 3. Delete edge and check if an owned row was deleted (P1-2)
    const deleted = await repo.deleteEdge(id);
    if (!deleted) {
      return NextResponse.json({ error: "Edge not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error("Failed to delete skill edge", error);
    return NextResponse.json({ error: "Failed to delete skill edge" }, { status: 500 });
  }
}
