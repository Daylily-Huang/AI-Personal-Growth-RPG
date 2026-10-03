"use client";

import { useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import type { RewardAccount, RewardRedemption, RewardSourceCandidate, RewardSourceType, RewardTransaction, Wish, WishAction } from "@/lib/reward/types";
import type { RewardLedgerState } from "@/lib/reward/fold";
import { RewardConfirmation, type RewardIntent } from "./RewardConfirmation";
import { WishEditor } from "./WishEditor";
import { WishProposals } from "./WishProposals";
import { ErrorNotice, dateText, errorOf, fieldClass, labelClass, MoreButton, readSelectedWish, rewardRequest, rowClass, statusText, useRewardPage } from "./client";

const balanceLabels: Array<[keyof RewardLedgerState, string]> = [
  ["current_available", "可用积分"], ["current_reserved", "已预留"], ["net_earned", "净获得"],
  ["lifetime_redeemed", "累计兑换"], ["correction_deficit", "修正缺口"], ["lifetime_earned", "累计获得"],
];
const actionLabels: Record<WishAction, string> = {
  activate: "激活心愿", "set-primary": "设为当前目标", reserve: "预留积分", unreserve: "释放预留", redeem: "兑换心愿", archive: "归档心愿", cancel: "取消心愿",
};
const actions: Record<Wish["status"], WishAction[]> = {
  IDEA: ["activate", "archive", "cancel"], ACTIVE: ["set-primary", "archive", "cancel"],
  PRIMARY: ["reserve", "archive", "cancel"], RESERVED: ["unreserve", "redeem"], REDEEMED: [], ARCHIVED: [], CANCELLED: [],
};
const eventLabels: Record<string, string> = { EARN: "获得", CORRECTION: "修正", RESERVE: "预留", UNRESERVE: "释放", REDEEM: "兑换", REFUND: "退款" };
const sourceLabels: Record<RewardSourceType, string> = { SEASON: "已完成赛季", QUEST: "合格任务", MASTERY: "已验证掌握度" };

export default function WishesClient() {
  const [revision, setRevision] = useState(0);
  const [account, setAccount] = useState<{ revision: number; balance?: RewardLedgerState; error?: Error } | null>(null);
  const [focus, setFocus] = useState<{ revision: number; wish?: Wish | null; error?: Error } | null>(null);
  const [sourceType, setSourceType] = useState<RewardSourceType>("QUEST");
  const [editor, setEditor] = useState<{ wish: Wish | null } | null>(null);
  const [proposalWish, setProposalWish] = useState<string | null>(null);
  const [intent, setIntent] = useState<RewardIntent | null>(null);
  const [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const focusAfterSave = useRef(false);
  const wishes = useRewardPage<Wish>("/api/rewards/wishes", "wishes", revision);
  const transactions = useRewardPage<RewardTransaction>("/api/rewards/transactions", "transactions", revision);
  const redemptions = useRewardPage<RewardRedemption & { refunded: boolean }>("/api/rewards/redemptions", "redemptions", revision);
  const sources = useRewardPage<RewardSourceCandidate>(`/api/rewards/sources?sourceType=${sourceType}`, "sources", revision);
  useEffect(() => {
    const controller = new AbortController();
    void rewardRequest<{ account: RewardAccount | null; balance: RewardLedgerState }>("/api/rewards/account", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setAccount({ revision, balance: result.balance });
    }).catch(error => { if (!controller.signal.aborted) setAccount({ revision, error: errorOf(error) }); });
    void readSelectedWish(controller.signal).then(wish => {
      if (!controller.signal.aborted) setFocus({ revision, wish });
    }).catch(error => { if (!controller.signal.aborted) setFocus({ revision, error: errorOf(error) }); });
    return () => controller.abort();
  }, [revision]);
  const currentAccount = account?.revision === revision ? account : null;
  const currentFocus = focus?.revision === revision ? focus : null;
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    if (focusAfterSave.current) { noticeRef.current?.focus(); focusAfterSave.current = false; }
  }, [revision]);
  function completed() {
    focusAfterSave.current = true;
    setIntent(null); setEditor(null);
    setNotice("操作已完成。正在重新读取余额与历史；若读取失败，请只重试读取，不必再次提交操作。");
    refresh();
  }
  function wishAction(wish: Wish, action: WishAction) {
    const effect = action === "reserve" ? `将预留 ${wish.credit_cost} 积分，不扣除 XP；兑换后的七天冷却由服务器检查。`
      : action === "unreserve" ? "释放已预留积分，心愿回到当前目标；不会新增奖励。"
      : action === "redeem" ? `使用已预留的 ${wish.credit_cost} 积分兑换，保留不可变凭证，并开始七天冷却。`
      : action === "set-primary" ? "同时只能有一个当前或已预留目标；此操作不扣除积分。"
      : action === "activate" ? "将构想设为可选择的心愿，不领取或扣除积分。"
      : "将保留心愿与历史记录；此操作不会删除账本或改变 XP。";
    setIntent({ id: crypto.randomUUID(), path: `/api/rewards/wishes/${wish.id}/${action}`, title: actionLabels[action],
      explanation: `${wish.title} · ${wish.id}。${effect}`, body: {}, ...(action === "redeem" ? { note: "celebrationNote" } : {}) });
  }
  return <div className="flex min-w-0 flex-col gap-6 text-[var(--text-primary)]" data-testid="wishes-workspace">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-2"><p className="text-xs tracking-widest text-[var(--text-secondary)]">REWARDS · WISHES</p>
        <h1 className="font-serif text-3xl">为真实成长，留一份期待</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">奖励积分与 XP、掌握度分开。记录值得期待的心愿，选择一个目标，再由你决定何时兑换。</p>
      </div>
      <div className="flex flex-wrap gap-2"><SecondaryButton onClick={refresh}>刷新数据</SecondaryButton><PrimaryButton onClick={() => setEditor({ wish: null })}>新建心愿</PrimaryButton></div>
    </header>
    {notice && <p ref={noticeRef} role="status" tabIndex={-1} className="rounded-[var(--radius-sm)] text-sm text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]">{notice}</p>}
    <SectionCard title="奖励积分" subtitle="只读服务端余额 · 不消费经验值">
      <ErrorNotice error={currentAccount?.error ?? null} retry={refresh} />
      {!currentAccount && <p role="status" className="mb-3 text-sm">正在读取余额…</p>}
      <dl className="grid min-w-0 grid-cols-2 gap-5 lg:grid-cols-3">
        {balanceLabels.map(([field, label]) => <div key={field} className="min-w-0"><dt className="text-xs text-[var(--text-secondary)]">{label}</dt><dd className="mt-1 break-all font-mono text-2xl" aria-label={label}>{currentAccount?.balance ? currentAccount.balance[field].toLocaleString("zh-CN") : "—"}</dd></div>)}
      </dl>
      {Boolean(currentAccount?.balance?.correction_deficit) && <p className="mt-4 text-sm">历史发放被修正，形成积分缺口。已兑换心愿和原凭证不会被追回或删除；后续积分先抵补缺口，没有罚息，也不影响 XP。</p>}
    </SectionCard>
    <SectionCard title="当前目标" subtitle="当前目标与已预留目标合计最多一个">
      <ErrorNotice error={currentFocus?.error ?? null} retry={refresh} />
      {!currentFocus ? <p role="status">正在查找当前目标…</p> : currentFocus.wish ? <div className="space-y-2 [overflow-wrap:anywhere]">
        <h2 className="font-serif text-xl">{currentFocus.wish.title}</h2><p className="text-sm">{statusText[currentFocus.wish.status]} · {currentFocus.wish.credit_cost} 奖励积分</p>
        <p className="text-sm text-[var(--text-secondary)]">{currentFocus.wish.description || "你可以按自己的节奏安排这份期待。"}</p>
        <p className="text-xs text-[var(--text-secondary)]">目标编号：{currentFocus.wish.id}</p>
        <div className="flex flex-wrap gap-2">{actions[currentFocus.wish.status].map(action => <SecondaryButton key={action} size="sm" aria-label={`当前目标：${actionLabels[action]}`} onClick={() => wishAction(currentFocus.wish!, action)}>{actionLabels[action]}</SecondaryButton>)}</div>
      </div> : !currentFocus.error && <p className="text-sm text-[var(--text-secondary)]">还没有选择当前目标。先记录心愿、设置预算并激活，再选择其中一个。</p>}
    </SectionCard>
    <SectionCard title="心愿清单" subtitle="构想 → 激活 → 当前目标 → 预留 → 兑换；历史始终保留">
      <div className="space-y-4">
        <ErrorNotice error={wishes.error} retry={wishes.retry} />
        {wishes.loading && <p role="status">正在读取心愿…</p>}
        {!wishes.loading && !wishes.error && !wishes.items.length && <p className="text-sm text-[var(--text-secondary)]">还没有心愿。可以从一场散步、一本书或一次体验开始。</p>}
        <div className="grid gap-4 xl:grid-cols-2">{wishes.items.map(wish => <article key={wish.id} aria-label={`心愿 ${wish.title}`} className={`${rowClass} space-y-3`}>
          <div className="flex flex-wrap justify-between gap-2"><h2 className="font-serif text-lg">{wish.title}</h2><span className="text-sm text-[var(--text-secondary)]">{statusText[wish.status]}</span></div>
          <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{wish.description || "暂无描述"}</p>
          <p className="text-sm">积分预算：{wish.credit_cost ?? "尚未设置"}</p>
          {wish.cooldown_until && <p className="text-sm text-[var(--text-secondary)]">兑换冷却截至 {dateText(wish.cooldown_until)}；退款不会抹去原兑换历史。</p>}
          <div className="flex flex-wrap gap-2">
            {(wish.status === "IDEA" || wish.status === "ACTIVE") && <SecondaryButton size="sm" onClick={() => setEditor({ wish })}>编辑心愿</SecondaryButton>}
            {actions[wish.status].map(action => <SecondaryButton key={action} size="sm" disabled={(["activate", "set-primary", "reserve"].includes(action) && !wish.credit_cost)} onClick={() => wishAction(wish, action)}>{actionLabels[action]}</SecondaryButton>)}
            <SecondaryButton size="sm" onClick={() => setProposalWish(wish.id)}>查看定价建议</SecondaryButton>
          </div>
          {!wish.credit_cost && (wish.status === "IDEA" || wish.status === "ACTIVE") && <p className="text-xs text-[var(--text-secondary)]">先设置积分预算，才能激活或选择。</p>}
        </article>)}</div>
        <MoreButton next={wishes.next} busy={wishes.moreBusy} onClick={() => void wishes.more()} />
      </div>
    </SectionCard>
    {proposalWish && <WishProposals key={proposalWish} id={proposalWish} revision={revision} onConfirm={setIntent} onClose={() => setProposalWish(null)} />}
    <SectionCard title="核验成长奖励" subtitle="候选不等于可领取；资格、金额和去重由服务器决定">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">只支持已完成赛季、合格任务和已验证的掌握度门槛。日常登录、打卡、专注时长不会产生积分；产物与现实里程碑奖励暂未开放。</p>
        <label className={`${labelClass} max-w-sm`}>奖励来源<select className={fieldClass} value={sourceType} onChange={event => setSourceType(event.target.value as RewardSourceType)}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <ErrorNotice error={sources.error} retry={sources.retry} />
        {sources.loading && <p role="status">正在读取候选来源…</p>}
        {!sources.loading && !sources.error && !sources.items.length && <p className="text-sm text-[var(--text-secondary)]">当前没有这一类来源，不需要为了积分制造记录。</p>}
        <ul className="space-y-3">{sources.items.map(source => <li key={source.id} className={`${rowClass} flex flex-wrap items-center justify-between gap-3`}>
          <div className="min-w-0 flex-1"><p className="text-sm">{source.label}</p><p className="mt-1 break-all font-mono text-xs text-[var(--text-secondary)]">{source.sourceId}</p></div>
          <SecondaryButton size="sm" disabled={source.alreadyGranted} onClick={() => setIntent({ id: crypto.randomUUID(), path: "/api/rewards/grants", title: "核验并领取奖励",
            explanation: `${source.label} · ${source.sourceId}。服务器按 reward-v1 核验资格和金额；同一来源只能获得一次奖励。`,
            body: { sourceType: source.sourceType, sourceId: source.sourceId, policyVersion: "reward-v1" },
          })}>{source.alreadyGranted ? "已领取" : "核验并领取"}</SecondaryButton>
        </li>)}</ul>
        <MoreButton next={sources.next} busy={sources.moreBusy} onClick={() => void sources.more()} />
      </div>
    </SectionCard>
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
      <SectionCard title="奖励账本" subtitle="追加式历史，不覆盖、不删除原记录">
        <div className="space-y-4"><ErrorNotice error={transactions.error} retry={transactions.retry} />
          {transactions.loading && <p role="status">正在读取账本…</p>}
          {!transactions.loading && !transactions.error && !transactions.items.length && <p className="text-sm text-[var(--text-secondary)]">暂无奖励流水。</p>}
          <ol className="space-y-3">{transactions.items.map(transaction => <li key={transaction.id} className={`${rowClass} space-y-2`}>
            <p className="text-sm">{eventLabels[transaction.event_kind]} · <span className="font-mono">{transaction.amount}</span> 积分</p>
            <p className="text-xs text-[var(--text-secondary)]">{dateText(transaction.created_at)} · {transaction.canonical_source_type} · {transaction.canonical_source_id}</p>
            <p className="text-xs text-[var(--text-secondary)]">流水编号：{transaction.id}{transaction.policy_version ? ` · ${transaction.policy_version}` : ""}</p>
            {transaction.note && <p className="whitespace-pre-wrap text-sm">说明：{transaction.note}</p>}
            {transaction.correction_for_id && <p className="text-xs">修正原流水：{transaction.correction_for_id}</p>}
            {transaction.refund_for_redemption_id && <p className="text-xs">退款凭证：{transaction.refund_for_redemption_id}</p>}
            {transaction.event_kind === "EARN" && <SecondaryButton size="sm" onClick={() => setIntent({ id: crypto.randomUUID(), path: `/api/rewards/transactions/${transaction.id}/correct`, title: "修正奖励发放",
              explanation: `原流水 ${transaction.id}，发放 ${transaction.amount} 积分。将追加等额负向修正；可能形成修正缺口，但不删除历史、不追回已兑换心愿、不影响 XP。`, body: {}, note: "note",
            })}>修正这笔发放</SecondaryButton>}
          </li>)}</ol><MoreButton next={transactions.next} busy={transactions.moreBusy} onClick={() => void transactions.more()} />
        </div>
      </SectionCard>
      <SectionCard title="兑换记录" subtitle="退款状态由账本派生，原兑换凭证不变">
        <div className="space-y-4"><ErrorNotice error={redemptions.error} retry={redemptions.retry} />
          {redemptions.loading && <p role="status">正在读取兑换记录…</p>}
          {!redemptions.loading && !redemptions.error && !redemptions.items.length && <p className="text-sm text-[var(--text-secondary)]">暂无兑换记录。</p>}
          <ol className="space-y-3">{redemptions.items.map(receipt => <li key={receipt.id} className={`${rowClass} space-y-2`}>
            <p className="text-sm">{receipt.credits_spent} 积分 · {receipt.refunded ? "已退款（原凭证保留）" : "已兑换"}</p>
            <p className="text-xs text-[var(--text-secondary)]">{dateText(receipt.redeemed_at)} · 心愿 {receipt.wish_id}</p>
            <p className="text-xs text-[var(--text-secondary)]">凭证编号：{receipt.id}</p>
            {receipt.celebration_note && <p className="whitespace-pre-wrap text-sm">{receipt.celebration_note}</p>}
            {!receipt.refunded && <SecondaryButton size="sm" onClick={() => setIntent({ id: crypto.randomUUID(), path: `/api/rewards/redemptions/${receipt.id}/refund`, title: "退回兑换积分",
              explanation: `凭证 ${receipt.id}，退回 ${receipt.credits_spent} 积分。只追加退款流水；心愿仍为已兑换，七天冷却与历史凭证保留。`, body: {}, note: "note",
            })}>申请积分退款</SecondaryButton>}
          </li>)}</ol><MoreButton next={redemptions.next} busy={redemptions.moreBusy} onClick={() => void redemptions.more()} />
        </div>
      </SectionCard>
    </div>
    {editor && <WishEditor wish={editor.wish} onClose={() => setEditor(null)} onSaved={completed} />}
    {intent && <RewardConfirmation key={intent.id} intent={intent} onClose={() => setIntent(null)} onSuccess={completed} />}
  </div>;
}
