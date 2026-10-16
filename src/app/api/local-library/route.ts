import { libraryFailure, libraryResponse, libraryUser } from "@/lib/local-library/http";

export async function GET(request: Request) {
  try {
    const { userId } = await libraryUser(request);
    return libraryResponse({ userId, aiConfigured: Boolean((process.env.AI_MODEL ?? process.env.OPENAI_MODEL)?.trim() && (process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY)?.trim()) });
  } catch (error) { return libraryFailure(error); }
}
