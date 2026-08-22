import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Edge ID is required" }, { status: 400 });
    }

    const repo = await getRequestRepository();
    await repo.deleteEdge(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error("Failed to delete skill edge", error);
    return NextResponse.json({ error: "Failed to delete skill edge" }, { status: 500 });
  }
}
