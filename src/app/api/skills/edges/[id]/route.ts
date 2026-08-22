import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
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
