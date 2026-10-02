import { rewardJson, rewardRoute } from "@/lib/reward/http";

export async function GET() {
  return rewardRoute(async service => rewardJson(await service.account()));
}
