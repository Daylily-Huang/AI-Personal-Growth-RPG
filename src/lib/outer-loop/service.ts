import { Phase8BRepository } from "./repository";
import type { SeasonContext, SeasonSummary } from "./types";

export class Phase8BService {
  constructor(private readonly repository: Phase8BRepository) {}

  async listSeasonSummaries(): Promise<SeasonSummary[]> {
    const seasons = await this.repository.listSeasons();
    const summaries = await Promise.all(
      seasons.map(async (season) => {
        const [links, reviews] = await Promise.all([
          this.repository.listLinks(season.id),
          this.repository.listReviews(season.id),
        ]);
        const latest = reviews.find((review) => review.supersededById === null) ?? reviews[0] ?? null;
        return {
          ...season,
          linkedQuestCount: links.length,
          reviewCount: reviews.length,
          latestReviewType: latest?.reviewType ?? null,
        } satisfies SeasonSummary;
      }),
    );
    return summaries;
  }

  async getSeasonContext(id: string): Promise<SeasonContext | null> {
    const season = await this.repository.getSeason(id);
    if (!season) return null;
    const [links, reviews] = await Promise.all([
      this.repository.listLinks(id),
      this.repository.listReviews(id),
    ]);
    const activities = await this.repository.listSeasonActivities(season, links);
    return { season, links, reviews, activities };
  }
}

export async function getPhase8BService(): Promise<Phase8BService> {
  const { getPhase8BRepository } = await import("./request");
  return new Phase8BService(await getPhase8BRepository());
}
