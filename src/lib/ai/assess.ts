import OpenAI from "openai";
import { buildAssessmentUserPrompt, SYSTEM_CONSTITUTION } from "./prompts";
import { AssessmentProposalSchema, type AssessmentProposal } from "./schemas";

export interface AssessmentContext {
  rawInput: string;
  totalMinutes?: number | null;
  effectiveMinutes?: number | null;
  recentSimilarCount: number;
  activeMainQuest?: string | null;
  relatedSkillNames?: string[];
}

const AI_MODEL = process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "deepseek-v4-flash";
const AI_BASE_URL = process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL;
const AI_API_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;

function makeClient(): OpenAI | null {
  if (!AI_API_KEY && !AI_BASE_URL) return null;
  return new OpenAI({
    apiKey: AI_API_KEY || "local-bridge",
    baseURL: AI_BASE_URL || undefined,
  });
}

/**
 * Server-side AI assessment.
 *
 * When no OpenAI-compatible credentials are configured, it falls back to a
 * deterministic local mock so the app remains runnable in demo mode.
 * In all cases the returned object is a Proposal — never a permanent write.
 */
export async function assessActivity(context: AssessmentContext): Promise<AssessmentProposal> {
  const client = makeClient();
  if (client) {
    try {
      const completion = await client.chat.completions.create({
        model: AI_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_CONSTITUTION },
          {
            role: "user",
            content: buildAssessmentUserPrompt({
              rawInput: context.rawInput,
              totalMinutes: context.totalMinutes,
              effectiveMinutes: context.effectiveMinutes,
              recentSimilarCount: context.recentSimilarCount,
              activeMainQuest: context.activeMainQuest,
            }),
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const proposal = parseProposalJson(content);
        const parsed = AssessmentProposalSchema.safeParse(proposal);
        if (parsed.success) {
          return parsed.data;
        }
      }
    } catch (error) {
      // Fall through to deterministic mock so an AI failure never deletes the Activity.
      console.error("AI assessment failed, using local deterministic fallback:", error);
    }
  }

  return mockAssessment(context);
}

function parseProposalJson(content: string): unknown {
  const tryParse = (text: string): unknown => {
    try {
      const parsed = JSON.parse(text) as { proposal?: unknown };
      if (parsed && typeof parsed === "object" && "proposal" in parsed) {
        return parsed.proposal;
      }
      return parsed;
    } catch {
      return undefined;
    }
  };

  const direct = tryParse(content);
  if (direct !== undefined) return direct;

  // Try to extract the outermost JSON object (handles markdown fences or extra prose).
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const extracted = tryParse(content.slice(start, end + 1));
    if (extracted !== undefined) return extracted;
  }

  return null;
}

export function mockAssessment(context: AssessmentContext): AssessmentProposal {
  const raw = context.rawInput.toLowerCase();
  const activityType = detectActivityType(raw);
  const evidenceLevel = detectEvidence(raw);
  const outcome = detectOutcome(raw);
  const learning = raw.includes("理解") || raw.includes("学") || raw.includes("read") || raw.includes("learn") ? 0.7 : 0.4;
  const performance = raw.includes("更快") || raw.includes("准确") || raw.includes("成功") || raw.includes("improve") ? 0.6 : 0.3;
  const difficulty = raw.includes("难") || raw.includes("复杂") || raw.includes("hard") || raw.includes("novel") ? 0.7 : 0.45;
  const novelty = raw.includes("新") || raw.includes("第一次") || raw.includes("new") || raw.includes("first") ? 0.8 : 0.4;
  const goalAlignment = raw.includes("论文") || raw.includes("毕业") || raw.includes("thesis") || raw.includes("main") ? 0.9 : 0.6;

  const detectedSkills = [
    ...(raw.includes("lc") ? ["LC"] : []),
    ...(raw.includes("lr") ? ["LR"] : []),
    ...(raw.includes("统计") || raw.includes("回归") ? ["Statistics"] : []),
    ...(raw.includes("论文") || raw.includes("写作") ? ["Academic Writing"] : []),
    ...(raw.includes("python") || raw.includes("代码") ? ["Programming"] : []),
  ];
  const affectedSkills = detectedSkills.length
    ? detectedSkills.map((name) => ({ name, reason: "与本次 Activity 最相关。" }))
    : context.relatedSkillNames?.length
      ? context.relatedSkillNames.map((name) => ({ name, reason: "与本次 Activity 最相关。" }))
      : [{ name: "General Growth", reason: "尚未建立明确技能节点，先归入通用成长。" }];

  const masteryFrom = 1;
  const masteryTo = evidenceLevel >= 4 ? 4 : evidenceLevel >= 2 ? 3 : Math.max(1, masteryFrom);

  return {
    activity: {
      type: activityType,
      completion: outcome,
    },
    difficulty: {
      complexity: difficulty,
      uncertainty: 0.4,
      expertise_gap: difficulty,
      resistance: 0.4,
    },
    growth: {
      effort: 0.5,
      learning,
      performance,
      outcome,
      artifact_value: raw.includes("sop") || raw.includes("笔记") || raw.includes("文档") || raw.includes("代码") ? 0.7 : 0.2,
      character_evidence: 0.1,
    },
    evidence: {
      level: evidenceLevel,
      explanation: evidenceExplanation(evidenceLevel),
    },
    affected_skills: affectedSkills,
    knowledge_updates: {
      proposed_nodes: raw.includes("理解") || raw.includes("read")
        ? [{ title: "新知识节点", domain: "General" }]
        : [],
      proposed_edges: [],
    },
    mastery_changes: [
      {
        target_type: "skill",
        target_name: affectedSkills[0].name,
        from_level: masteryFrom,
        proposed_level: masteryTo,
        confidence: 0.6 + evidenceLevel * 0.05,
        verification_required: masteryTo >= 5,
        reason: `证据等级 E${evidenceLevel} 支持当前保守 Mastery 提议。`,
      },
    ],
    xp_semantics: {
      base_value: Math.min(30, 10 + evidenceLevel * 3 + (context.totalMinutes ? Math.floor(context.totalMinutes / 30) : 0)),
      difficulty,
      mastery_gain: learning,
      novelty,
      goal_alignment: goalAlignment,
      repetition_risk: context.recentSimilarCount > 5 ? "high" : context.recentSimilarCount > 1 ? "medium" : "low",
    },
    artifacts: raw.includes("sop") || raw.includes("笔记") || raw.includes("文档") || raw.includes("代码")
      ? [{ title: "新 Artifact", type: "Document", confirmed_existing: false }]
      : [],
    next_quest: {
      title: "把本次所学应用到真实任务",
      reason: "下一步应验证是否真正掌握。",
    },
    confidence: 0.65,
    uncertainty_notes: ["本地演示模式：未调用真实模型，请将结果视为示例。"],
  };
}

function detectActivityType(raw: string): AssessmentProposal["activity"]["type"] {
  if (raw.includes("代码") || raw.includes("写") || raw.includes("完成") || raw.includes("build") || raw.includes("写论文") || raw.includes("跑数据") || raw.includes("跑通")) return "production";
  if (raw.includes("跑步") || raw.includes("运动") || raw.includes("锻炼") || raw.includes("健身") || raw.includes("run ")) return "physical";
  if (raw.includes("整理") || raw.includes("打扫") || raw.includes("买菜") || raw.includes("洗衣")) return "maintenance";
  if (raw.includes("复盘") || raw.includes("反思") || raw.includes("review")) return "reflection";
  if (raw.includes("练习") || raw.includes("训练") || raw.includes("practice")) return "skill";
  return "learning";
}

function detectEvidence(raw: string): number {
  if (raw.includes("实际应用") || raw.includes("独立完成") || raw.includes("真实任务") || raw.includes("deploy")) return 4;
  if (raw.includes("复现") || raw.includes("跑通") || raw.includes("reproduce")) return 3;
  if (raw.includes("解释") || raw.includes("理解") || raw.includes("explain") || raw.includes("understand")) return 2;
  if (raw.includes("读") || raw.includes("看") || raw.includes("read") || raw.includes("watch")) return 1;
  return 0;
}

function detectOutcome(raw: string): number {
  if (raw.includes("失败") || raw.includes("fail")) return 0.2;
  if (raw.includes("完成") || raw.includes("成功") || raw.includes("done") || raw.includes("finish")) return 0.9;
  return 0.5;
}

function evidenceExplanation(level: number): string {
  const table = [
    "用户自述，缺少可验证证据。",
    "用户提供了总结，属于 E1。",
    "用户表现出正确理解/解释，属于 E2。",
    "用户能够复现，属于 E3。",
    "用户在真实任务中应用，属于 E4。",
    "用户多次独立使用，属于 E5。",
    "用户形成系统化/创造性成果，属于 E6。",
  ];
  return table[level] ?? table[0];
}


