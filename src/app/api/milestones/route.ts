import { bodyObject, confirmInput, milestoneJson, milestoneRoute, noQuery, optionalEnum, pagination } from "@/lib/milestone/http";

export async function GET(request: Request) {
  return milestoneRoute(async repo => {
    const p = pagination(request, ["status", "recognitionClass"]);
    const query = new URL(request.url).searchParams;
    const result = await repo.list(p, {
      status: optionalEnum(query.get("status"), ["ACTIVE", "REVOKED"] as const),
      recognitionClass: optionalEnum(query.get("recognitionClass"), ["CORE_VERIFIED", "USER_CONFIRMED_REAL_WORLD"] as const),
    });
    return milestoneJson({ milestones: result.items, nextOffset: result.nextOffset });
  });
}
export async function POST(request: Request) {
  return milestoneRoute(async repo => {
    noQuery(request);
    return milestoneJson(await repo.confirm(confirmInput(await bodyObject(request))));
  });
}
