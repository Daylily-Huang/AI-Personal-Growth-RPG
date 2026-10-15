"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { LevelBadge, ToastNotification } from "@/components/ui";
import styles from "./SettlementFeedback.module.css";

const MOTION_PREFERENCE = "rpg:growth-effects";

/** Local presentation preference; never writes player or growth state. */
export function GrowthStage({ children, className = "" }: { children: ReactNode; className?: string }) {
  // Start still on server/first paint; restore the choice before enabling motion.
  const [motion, setMotion] = useState<boolean | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setMotion(window.localStorage.getItem(MOTION_PREFERENCE) !== "off"); } catch { setMotion(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className={`${styles.stage} ${className}`} data-growth-motion={motion ? "on" : "off"}>
    <div className={styles.atmosphere} aria-hidden="true"><i /><i /><i /></div>
    <div className={styles.motionControl}>
      <button type="button" aria-pressed={motion === true} disabled={motion === null} onClick={() => {
        const next = !motion; setMotion(next);
        try { window.localStorage.setItem(MOTION_PREFERENCE, next ? "on" : "off"); } catch { /* Keep the in-memory choice. */ }
      }}><span aria-hidden="true">✦</span> 动态效果：{motion ? "开启" : "关闭"}</button>
    </div>
    {children}
  </div>;
}

const SPARKS = Array.from({ length: 12 }, (_, index) => {
  const angle = index * Math.PI / 6;
  return { "--spark-x": `${Math.cos(angle) * (38 + index % 3 * 12)}px`, "--spark-y": `${Math.sin(angle) * (38 + index % 3 * 12)}px`, "--spark-delay": `${index % 4 * 24}ms`, "--spark-turn": `${index * 37}deg` } as CSSProperties;
});

export function GrowthRipple() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setVisible(false), 1500); return () => window.clearTimeout(timer); }, []);
  return visible ? <span className={styles.growthRipple} aria-hidden="true" data-testid="growth-ripple" /> : null;
}

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
  const [animate, setAnimate] = useState(animateArrival);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setTimeout(() => setAnimate(false), 1500);
    return () => window.clearTimeout(timer);
  }, [animate]);
  useEffect(() => { onPresented?.(receipt.id); }, [onPresented, receipt.id]);
  const levelChanged = receipt.previousPlayerLevel !== undefined && currentPlayerLevel !== undefined && currentPlayerLevel > receipt.previousPlayerLevel;
  return <div className={`${styles.receipt}${animate ? ` ${styles.arrival}` : ""}${levelChanged ? ` ${styles.levelReceipt}` : ""}`} data-testid="settlement-feedback">
    {animate && receipt.amount > 0 ? <div className={styles.sparks} aria-hidden="true" data-testid="settlement-sparks">{SPARKS.map((style, index) => <i key={index} style={style} />)}</div> : null}
    <ToastNotification variant="success" title="成长已入账" onDismiss={onDismiss} className="max-w-none"
      icon={<span className={styles.receiptSeal} aria-hidden="true">✦</span>}
      message={<div className="space-y-1 break-words">
        <p className={`${styles.xpReadout} font-semibold tabular-nums`}>{receipt.amount > 0 ? "+" : ""}{receipt.amount} XP <span className={styles.skillName}>· {receipt.skillName || "本次真实活动"}</span></p>
        <p>以已确认账本为准；XP不等于Mastery。</p>
        {levelChanged ? <div className={styles.levelCelebration} data-testid="level-celebration">
          <span className={styles.levelOrbit} aria-hidden="true" />
          <span className={styles.levelKicker}>LEVEL UP</span>
          <p className="flex flex-wrap items-center gap-2">角色等级已更新 <LevelBadge level={currentPlayerLevel!} /></p>
          <span className="text-xs">以刷新后的角色记录为准</span>
        </div> : null}
        <Link className="inline-flex min-h-11 items-center underline" href={`/activities/${receipt.activityId}`}>查看本次活动与入账依据</Link>
      </div>} />
  </div>;
}
