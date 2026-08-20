import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST() {
  try {
    if (isSupabaseConfigured()) {
      const client = await getSupabaseServerClient();
      await client.auth.signOut();
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to sign out", error);
    return NextResponse.json({ error: "Failed to sign out" }, { status: 500 });
  }
}
