import { milestoneJson, milestoneRoute, optionalEnum, pagination } from "@/lib/milestone/http";

export async function GET(request: Request) {
  return milestoneRoute(async repo => {
    const p = pagination(request, ["status"]);
    const status = optionalEnum(new URL(request.url).searchParams.get("status"), ["PROPOSED", "ACCEPTED", "EDITED", "REJECTED"] as const);
    const result = await repo.proposals(p, status);
    return milestoneJson({ proposals: result.items, nextOffset: result.nextOffset, recognitionOnly: true });
  });
}
