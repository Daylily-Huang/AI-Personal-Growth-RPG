import { reviewJson, reviewRoute } from "@/lib/review-insights/http";
import { parseReviewQuery } from "@/lib/review-insights/validation";

export async function GET(request: Request) {
  return reviewRoute(async repository => reviewJson({ summary: await repository.summarize(parseReviewQuery(request)) }));
}
