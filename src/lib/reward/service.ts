import { foldRewardLedger } from "./fold";
import { getRewardRepository } from "./request";
import { RewardRepositoryError, type RewardRepository } from "./repository";
import type { Pagination, RewardGrantInput, RewardSourceType, WishAction, WishMetadata } from "./types";

export class RewardService {
  constructor(private readonly repo: RewardRepository) {}
  async account() {
    const account = await this.repo.account();
    const balance = account ? {
      lifetime_earned: account.lifetime_earned, net_earned: account.net_earned,
      lifetime_redeemed: account.lifetime_redeemed, current_reserved: account.current_reserved,
      current_available: account.current_available, correction_deficit: account.correction_deficit,
    } : foldRewardLedger([]);
    return { account, balance };
  }
  transactions(p: Pagination) { return this.repo.transactions(p); }
  redemptions(p: Pagination) { return this.repo.redemptions(p); }
  wishes(p: Pagination) { return this.repo.wishes(p); }
  sources(type: RewardSourceType, p: Pagination) { return this.repo.sources(type, p); }
  async wish(id: string) {
    const wish = await this.repo.wish(id);
    if (!wish) throw new RewardRepositoryError("WISH_NOT_FOUND", "P0002");
    return wish;
  }
  createWish(input: WishMetadata & { title: string }) { return this.repo.createWish(input); }
  async editWish(id: string, input: WishMetadata) {
    const wish = await this.repo.editWish(id, input);
    if (!wish) throw new RewardRepositoryError("WISH_NOT_FOUND", "P0002");
    return wish;
  }
  async proposals(id: string, p: Pagination) {
    await this.wish(id);
    return this.repo.proposals(id, p);
  }
  // Mutations deliberately do NOT prefetch ownership or current state: RPC replay wins first.
  grant(input: RewardGrantInput) { return this.repo.grant(input); }
  wishAction(id: string, action: WishAction, key: string, note?: string | null) { return this.repo.wishAction(id, action, key, note); }
  correct(id: string, note: string, key: string) { return this.repo.correct(id, note, key); }
  refund(id: string, note: string, key: string) { return this.repo.refund(id, note, key); }
}
export async function getRewardService() { return new RewardService(await getRewardRepository()); }
