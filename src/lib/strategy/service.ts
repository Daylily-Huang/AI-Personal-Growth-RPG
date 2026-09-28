import { getStrategyRepository } from "./request";
import type { StrategyRepository } from "./repository";
import type { StrategyContext } from "./types";

export class StrategyService {
  constructor(private readonly repository: StrategyRepository) {}

  list() { return this.repository.list(); }

  async getContext(id: string): Promise<StrategyContext | null> {
    const strategy = await this.repository.get(id);
    if (!strategy) return null;
    const [versions, supports] = await Promise.all([
      this.repository.listVersions(id), this.repository.listSupports(id),
    ]);
    return { strategy, versions, supports };
  }
}

export async function getStrategyService(): Promise<StrategyService> {
  return new StrategyService(await getStrategyRepository());
}
