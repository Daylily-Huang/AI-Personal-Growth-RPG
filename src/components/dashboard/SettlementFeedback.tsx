"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LevelBadge, ToastNotification } from "@/components/ui";
import styles from "./SettlementFeedback.module.css";

export interface SettlementReceipt {
  id: string;
  activityId: string;
  amount: number;
  skillName: string;
  previousPlayerLevel?: number;
}

/** Presentation only. Never derive an award or capability change from a proposal. */
export function settlementReceipt(value: unknown, assessmentId: string): SettlementReceipt | null {
  if (!value || typeof value !== "object") return null;
  const transaction = (value as { transaction?: Record<string, unknown> }).transaction;
  if (!transaction || transaction.assessmentId !== assessmentId || transaction.xpType !== "activity"
    || typeof transaction.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transaction.id)
    || typeof transaction.activityId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transaction.activityId)
    || !Number.isSafeInteger(transaction.amount) || typeof transaction.skillName !== "string") return null;
  return { id: transaction.id, activityId: transaction.activityId, amount: transaction.amount as number, skillName: transaction.skillName };
}

export default function SettlementFeedback({ receipt, currentPlayerLevel, onDismiss, animateArrival = true, onPresented }: { receipt: SettlementReceipt; currentPlayerLevel?: number; onDismiss: () => void; animateArrival?: boolean; onPresented?: (id: string) => void }) {
  const [animate] = useState(animateArrival);
  useEffect(() => { onPresented?.(receipt.id); }, [onPresented, receipt.id]);
  const levelChanged = receipt.previousPlayerLevel !== undefined && currentPlayerLevel !== undefined && currentPlayerLevel > receipt.previousPlayerLevel;
  return <div className={`${styles.receipt}${animate ? ` ${styles.arrival}` : ""}`} data-testid="settlement-feedback">
    <ToastNotification variant="success" title="成长已入账" onDismiss={onDismiss} className="max-w-none"
      message={<div className="space-y-1 break-words">
        <p className="text-base font-semibold tabular-nums">{receipt.amount > 0 ? "+" : ""}{receipt.amount} XP <span className="text-sm font-normal">· {receipt.skillName || "本次真实活动"}</span></p>
        <p>以已确认账本为准；XP不等于Mastery。</p>
        {levelChanged ? <p className="flex flex-wrap items-center gap-2">角色等级已更新 <LevelBadge level={currentPlayerLevel!} /><span className="text-xs">以刷新后的角色记录为准</span></p> : null}
        <Link className="inline-flex min-h-11 items-center underline" href={`/activities/${receipt.activityId}`}>查看本次活动与入账依据</Link>
      </div>} />
  </div>;
}
