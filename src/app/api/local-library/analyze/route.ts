import { AnalyzeSchema } from "@/lib/local-library/schema";
import { proposeLibrary } from "@/lib/local-library/ai";
import { LibraryError, rememberDraft } from "@/lib/local-library/store";
import { libraryBody, libraryFailure, libraryResponse, libraryUser } from "@/lib/local-library/http";

export async function POST(request: Request) {
  try {
    const { userId } = await libraryUser(request);
    const input = AnalyzeSchema.parse(await libraryBody(request));
    let draft;
    try { draft = await proposeLibrary(input.files, request.signal); }
    catch (error) { throw new LibraryError(error instanceof Error ? error.message : "AI整理失败，未记录活动", 502); }
    rememberDraft(userId, draft);
    return libraryResponse({ draft });
  } catch (error) { return libraryFailure(error); }
}
