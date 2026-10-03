import { authorityResult, onlyFields, requestKey, rewardBody, rewardRoute, text } from "@/lib/reward/http";

export async function POST(request: Request) {
  return rewardRoute(async service => {
    const body = await rewardBody(request);
    onlyFields(body, ["sourceType", "sourceId", "policyVersion", "requestIdempotencyKey"]);
    // Unsupported-but-reserved classes must reach the RPC's durable rejection audit.
    return authorityResult(await service.grant({
      sourceType: text(body.sourceType, 100).toUpperCase(), sourceId: text(body.sourceId, 200),
      policyVersion: text(body.policyVersion, 100), requestIdempotencyKey: requestKey(body.requestIdempotencyKey),
    }));
  });
}
