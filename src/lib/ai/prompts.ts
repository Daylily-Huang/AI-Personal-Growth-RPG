import { PromptVersion } from "./schemas";

export const SYSTEM_CONSTITUTION = `
你是 AI Personal Growth RPG 的 Game Master。
你的任务不是让用户感觉良好，而是准确识别真实成长，并将现实行为映射为结构化成长提议。

优先级：真实性 > 成长价值 > 可验证性 > 长期可持续 > 游戏反馈 > 短期刺激。

必须遵守：
1. 时间不是经验；耗时不能线性换算 XP。
2. XP 不等于 Mastery。
3. 所有高 Mastery 需要证据；仅凭“我会了”不能给 M6+。
4. AI 只产生 Proposal，不直接修改永久状态。
5. 失败可以产生 Learning XP。
6. 重复行为经验递减；真实突破可以例外。
7. 临时状态不得冒充永久能力变化。
8. 不能因为鼓励用户而虚增评分。
9. 不确定时输出 uncertainty 与 confidence。
10. 重要判断必须解释原因。
`.trim();

const OUTPUT_SHAPE = `{
  "activity": { "type": "learning|skill|production|physical|maintenance|reflection", "completion": 0.0-1.0 },
  "difficulty": { "complexity": 0.0-1.0, "uncertainty": 0.0-1.0, "expertise_gap": 0.0-1.0, "resistance": 0.0-1.0 },
  "growth": { "effort": 0.0-1.0, "learning": 0.0-1.0, "performance": 0.0-1.0, "outcome": 0.0-1.0, "artifact_value": 0.0-1.0, "character_evidence": 0.0-1.0 },
  "evidence": { "level": 0-6, "explanation": "string" },
  "affected_skills": [{ "name": "string", "reason": "string" }],
  "knowledge_updates": { "proposed_nodes": [{ "title": "string", "domain": "string" }], "proposed_edges": [{ "source": "string", "target": "string", "relation": "string" }] },
  "mastery_changes": [{ "target_type": "skill|knowledge", "target_name": "string", "from_level": 0-10, "proposed_level": 0-10, "confidence": 0.0-1.0, "verification_required": true/false, "reason": "string" }],
  "xp_semantics": { "base_value": 1-100, "difficulty": 0.0-1.0, "mastery_gain": 0.0-1.0, "novelty": 0.0-1.0, "goal_alignment": 0.0-1.0, "repetition_risk": "low|medium|high" },
  "artifactProposals": [{ "title": "string", "artifactType": "document|code_repository|design_spec|data_analysis|presentation|synthesis_note|creative_work|other", "summary": "string", "description": "string", "reusabilityScore": 0.0-1.0 }],
  "next_quest": { "title": "string", "reason": "string" },
  "confidence": 0.0-1.0,
  "uncertainty_notes": ["string"]
}`;

export function buildAssessmentUserPrompt(input: {
  rawInput: string;
  totalMinutes?: number | null;
  effectiveMinutes?: number | null;
  recentSimilarCount: number;
  activeMainQuest?: string | null;
}): string {
  return `
请评估以下现实 Activity，输出严格符合以下 JSON 结构（不要包裹在 proposal 里，直接输出顶层对象）。

必需 JSON 结构：
${OUTPUT_SHAPE}

Activity 原文：
${input.rawInput}

上下文：
- total_minutes: ${input.totalMinutes ?? "unknown"}
- effective_minutes: ${input.effectiveMinutes ?? "unknown"}
- recent_similar_count: ${input.recentSimilarCount}
- active_main_quest: ${input.activeMainQuest ?? "none"}

输出要求：
- evidence.level 使用数字 E0–E6：0 自述、1 总结、2 正确解释、3 复现、4 真实应用、5 多次独立使用、6 系统化/创造。
- mastery_changes 只给保守提议；高 Mastery 必须 verification_required=true。
- xp_semantics 是语义判断，不是最终 XP；最终 XP 由服务器 Growth Engine 计算。
- repetition_risk 只是基于当前单条文字的 AI 估算（可能为 low/medium/high）；服务器会在 Confirm 时按最近相似行为重新计算权威 repetitionCount，并施加真正的重复惩罚。
- artifactProposals 是对本次行为产生的持久交付物的提议（0、1或多个）；类型必须是 8 种严格类型之一。
- 若信息不足，降低 confidence 并写入 uncertainty_notes。
`.trim();
}

export function getPromptVersion(): string {
  return PromptVersion;
}
