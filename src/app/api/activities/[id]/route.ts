import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthRequiredError, getAuthenticatedRepository } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/** Private, request-scoped read only. Never fall back to demo or service-role data. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Activity connection is not configured" }, { status: 503, headers });
  }
  try {
    const repository = await getAuthenticatedRepository();
    const { id } = await context.params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid activity ID" }, { status: 400, headers });
    const activity = await repository.getActivity(id);
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404, headers });
    return NextResponse.json({ activity }, { status: 200, headers });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
    }
    return NextResponse.json({ error: "Unable to load activity" }, { status: 500, headers });
  }
}
