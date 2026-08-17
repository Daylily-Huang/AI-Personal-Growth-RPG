# AI Personal Growth RPG — Harness 架构与实施手册

> **版本：v0.2**
>
> 本文档回答：
>
> > Harness 到底是什么？为什么需要？什么时候搭？目录怎么建？Case 怎么写？Runner 怎么跑？LLM 怎么评估？CI 怎么拦截回归？
>
> 本项目采用 **“轻量 Agent Harness + Deterministic Growth Harness + LLM Eval Harness + E2E Harness”** 四层结构。
>
> **不采用**第一阶段即引入复杂多 Agent 编排平台的方案。

---

# 1. Harness 的定义

在本项目中，Harness 不是一个单独的“大型 AI 框架”。

它是一组围绕系统的：

- 规范
- 固定输入案例
- 自动执行器
- 判定器
- 测试
- 报告
- CI 门禁

共同组成的“安全笼”。

它的目标是：

> **确保无论换模型、改 Prompt、改 XP 公式、换 Coding Agent，系统仍然遵守原始 Growth Constitution。**

---

# 2. 为什么这个项目必须有 Harness

普通 Web App 的回归通常表现为：

```text
按钮坏了
页面报错
API 500
```

AI Personal Growth RPG 更危险的回归是：

```text
页面完全正常
但评分逻辑悄悄坏了
```

例如：

```text
旧版本：
“读了 2 小时论文，只能复述摘要”
→ E1
→ M2 candidate
→ 18 XP

新 Prompt：
→ E4
→ M6
→ 180 XP
```

代码可能完全没有报错。

但：

> **整个成长经济已经失真。**

因此必须建立固定行为案例作为“回归标尺”。

---

# 3. Harness 四层架构

```text
┌───────────────────────────────────────┐
│ Layer 1 — Agent Harness               │
│ AGENTS.md / docs / startup protocol   │
├───────────────────────────────────────┤
│ Layer 2 — Deterministic Harness       │
│ XP / levels / anti-farming / mastery  │
├───────────────────────────────────────┤
│ Layer 3 — LLM Eval Harness            │
│ Parser / Evaluator / Verifier / Review│
├───────────────────────────────────────┤
│ Layer 4 — E2E Harness                 │
│ Real browser user flow                │
└───────────────────────────────────────┘
```

四层分别解决不同问题。

---

# 4. Layer 1 — Coding Agent Harness

## 4.1 目的

回答：

> “接手这个仓库的 AI 开发 Agent，怎么知道自己能改什么、不能改什么？”

主要由以下组成：

```text
AGENTS.md
docs/
STARTUP_PROMPT.md
CHANGELOG
ADR
```

---

# 5. 根目录 AGENTS.md

仓库根目录创建：

```text
AGENTS.md
```

它是 Coding Agent 的长期约束入口。

建议内容见本规格包提供的：

```text
AGENTS.md
```

核心规则：

- 编码前先读 specs
- 不擅自修改 Growth Constitution
- 重要规则变更必须询问用户
- 所有修改必须测试
- AI 不直接写正式 XP
- RLS 不允许关闭
- Scope 不得擅自扩大

---

# 6. Layer 2 — Deterministic Growth Harness

这是最早应该搭建的 Harness。

它负责测试：

- XP Engine
- Level Curve
- Repetition Penalty
- Novelty
- Evidence multiplier
- Goal Alignment
- Quest Size cap
- Mastery eligibility
- Idempotency

这些逻辑必须：

> **不调用 LLM。**

---

# 7. 为什么确定性部分必须与 LLM 分离

如果 XP 直接让 LLM 返回：

```text
+47 XP
```

则：

- 模型改变会漂移
- Temperature/推理差异会漂移
- Prompt 改动会漂移
- 很难精确测试

因此：

```text
LLM:
“这是中等偏高难度，Evidence E2，Novelty 高”

↓

TypeScript Growth Engine:
最终计算 XP
```

Harness 能稳定测试后者。

---

# 8. 推荐仓库结构

正式项目建议：

```text
personal-growth-rpg/
│
├── AGENTS.md
│
├── docs/
│
├── src/
│
│   └── lib/
│       └── growth-engine/
│           ├── xp.ts
│           ├── mastery.ts
│           ├── novelty.ts
│           ├── difficulty.ts
│           ├── levels.ts
│           └── rules.ts
│
├── harness/
│   ├── README.md
│   │
│   ├── cases/
│   │   ├── xp/
│   │   ├── mastery/
│   │   ├── anti-farming/
│   │   ├── evidence/
│   │   ├── llm-assessment/
│   │   ├── verifier/
│   │   └── review/
│   │
│   ├── schemas/
│   │   ├── case.schema.ts
│   │   └── result.schema.ts
│   │
│   ├── runners/
│   │   ├── deterministic.ts
│   │   ├── llm.ts
│   │   └── all.ts
│   │
│   ├── graders/
│   │   ├── exact.ts
│   │   ├── range.ts
│   │   ├── invariant.ts
│   │   └── semantic.ts
│   │
│   ├── reports/
│   │
│   └── fixtures/
│
├── tests/
│   ├── unit/
│   └── e2e/
│
└── package.json
```

---

# 9. 为什么 Harness Case 要独立于普通 Test

普通 Unit Test：

```ts
expect(calculateXp(input)).toBe(28)
```

主要回答：

> 函数是否符合明确公式。

Harness Case：

```text
“一个人第 30 次完成相同 PCR 操作，但没有新突破”
```

主要回答：

> 系统哲学是否仍然正确。

因此：

```text
tests/
```

负责代码正确性。

```text
harness/
```

负责系统行为正确性。

两者有重叠，但不能完全合并。

---

# 10. Harness Case 的标准格式

推荐使用 JSON。

例如：

```json
{
  "id": "xp-time-farming-001",
  "category": "anti-farming",
  "description": "相同产出下，时间增加不应线性增加XP",

  "input": {
    "baseValue": 20,
    "difficulty": 1.0,
    "masteryGain": 1.0,
    "evidence": 1.0,
    "novelty": 1.0,
    "goalAlignment": 1.0,
    "repetitionCount": 0,
    "effectiveMinutes": 300
  },

  "expected": {
    "xp": {
      "min": 15,
      "max": 35
    },
    "invariants": [
      "TIME_NOT_LINEAR"
    ]
  }
}
```

---

# 11. Case 不应该全部锁死精确数值

错误：

```json
{
  "expectedXp": 28
}
```

如果 XP 规则未来从 v0.1 改到 v0.2：

> 所有测试都碎掉。

更合理：

```json
{
  "xp": {
    "min": 20,
    "max": 40
  }
}
```

以及：

```json
{
  "invariants": [
    "LESS_THAN_FIRST_TIME_XP",
    "NO_MASTERY_UPGRADE"
  ]
}
```

---

# 12. 测试分三类

## 12.1 Exact Assertions

适合纯逻辑。

例如：

```text
repeated confirm
→ transaction count 必须 = 1
```

## 12.2 Range Assertions

适合 XP。

例如：

```text
20 <= XP <= 35
```

## 12.3 Invariant Assertions

最重要。

例如：

```text
M6_REQUIRES_E4_OR_HIGHER
TIME_DOES_NOT_SCALE_LINEarly
FAILURE_CAN_HAVE_LEARNING_XP
LOW_VALUE_MAINTENANCE_CANNOT_DAMAGE_MAIN_LEVEL
```

---

# 13. 建议建立 Invariant Registry

创建：

```text
harness/graders/invariant.ts
```

概念：

```ts
export type Invariant =
  | "TIME_NOT_LINEAR"
  | "M6_REQUIRES_HIGH_EVIDENCE"
  | "REPETITION_REDUCES_XP"
  | "FAILURE_CAN_REWARD_LEARNING"
  | "NO_PERMANENT_XP_PUNISHMENT"
  | "CONFIRM_IS_IDEMPOTENT"
  | "AI_CANNOT_WRITE_LEDGER"
```

---

# 14. 第一个 XP Harness Case

文件：

```text
harness/cases/xp/xp-new-learning-001.json
```

示例：

```json
{
  "id": "xp-new-learning-001",
  "category": "xp",
  "description": "首次真正理解一个重要新概念",

  "input": {
    "baseValue": 20,
    "difficulty": 1.2,
    "masteryGain": 1.1,
    "evidence": 1.0,
    "novelty": 1.2,
    "goalAlignment": 1.0,
    "repetitionCount": 0
  },

  "expected": {
    "xp": {
      "min": 20,
      "max": 45
    }
  }
}
```

---

# 15. 时间刷分对照组

Harness 最好支持：

> Pair Case。

例如：

```json
{
  "id": "anti-time-farming-001",

  "inputA": {
    "effectiveMinutes": 60,
    "outcome": 0.7
  },

  "inputB": {
    "effectiveMinutes": 300,
    "outcome": 0.7
  },

  "expected": {
    "relation": "B_NOT_5X_A"
  }
}
```

---

# 16. 重复刷分 Case

```json
{
  "id": "anti-repeat-001",
  "description": "第30次低难重复操作",

  "firstTime": {
    "repetitionCount": 0
  },

  "repeated": {
    "repetitionCount": 29
  },

  "expected": {
    "relation": "REPEATED_XP_MUCH_LOWER"
  }
}
```

建议最低要求：

```text
repeated XP < first XP × 0.4
```

具体阈值由 `rules_version` 定义。

---

# 17. “重复但突破” Case

不能简单地：

> repetition = high → XP 永远低。

例如：

```text
第30次 PCR
但首次把成功率从 70% → 95%
```

Expected：

```text
Maintenance XP low
Performance XP high
```

这个 Case 非常重要，否则系统会压制真实精进。

---

# 18. Failure Case

输入：

```text
PCR 失败
但定位到 DNA inhibition
并形成 dilution troubleshooting 流程
```

Expected：

```text
Outcome = low
Learning > 0
Skill > 0
Artifact candidate = true
```

必须防止：

```text
failed = zero everything
```

---

# 19. Mastery Harness

Mastery Case 推荐格式：

```json
{
  "id": "mastery-self-report-001",

  "input": {
    "currentMastery": 2,
    "claim": "我已经完全掌握PGLS",
    "evidenceLevel": 0
  },

  "expected": {
    "maxProposedMastery": 3,
    "verificationRequired": true
  }
}
```

---

# 20. Mastery 核心固定 Case

至少建立：

```text
M-001 self-report
M-002 correct explanation
M-003 guided application
M-004 independent real application
M-005 repeated independent use
M-006 transfer to novel context
M-007 systemized SOP
M-008 teaching
M-009 creation
M-010 long-term decay
```

---

# 21. Evidence Harness

重点验证：

```text
用户行为
→ Evidence 是否被高估
```

Case：

```text
“我读完了论文。”
```

Expected：

```text
E0–E1
```

而：

```text
用户提交自己完成的真实分析并解释选择依据
```

Expected：

```text
E3–E4 candidate
```

---

# 22. Deterministic Runner

创建：

```text
harness/runners/deterministic.ts
```

概念代码：

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { calculateXp } from "@/lib/growth-engine/xp";

type HarnessResult = {
  id: string;
  passed: boolean;
  actual?: unknown;
  errors: string[];
};

async function loadJsonCases(dir: string) {
  const names = await fs.readdir(dir);
  const jsonFiles = names.filter((name) => name.endsWith(".json"));

  return Promise.all(
    jsonFiles.map(async (name) => {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      return JSON.parse(raw);
    }),
  );
}

export async function runXpCases(): Promise<HarnessResult[]> {
  const cases = await loadJsonCases("harness/cases/xp");
  const results: HarnessResult[] = [];

  for (const testCase of cases) {
    const actual = calculateXp(testCase.input);
    const errors: string[] = [];

    if (actual.finalXp < testCase.expected.xp.min) {
      errors.push("XP below minimum");
    }

    if (actual.finalXp > testCase.expected.xp.max) {
      errors.push("XP above maximum");
    }

    results.push({
      id: testCase.id,
      passed: errors.length === 0,
      actual,
      errors,
    });
  }

  return results;
}
```

正式实现要加 Zod 校验。

---

# 23. Harness Schema Validation

所有 JSON Case 先经过 Zod。

例如：

```ts
import { z } from "zod";

export const XpHarnessCaseSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),

  input: z.object({
    baseValue: z.number(),
    difficulty: z.number(),
    masteryGain: z.number(),
    evidence: z.number(),
    novelty: z.number(),
    goalAlignment: z.number(),
    repetitionCount: z.number().int().nonnegative(),
  }),

  expected: z.object({
    xp: z.object({
      min: z.number(),
      max: z.number(),
    }),
  }),
});
```

目的：

> Case 本身写错时要立即失败。

---

# 24. Vitest 与 Harness 的关系

Vitest 非常适合执行：

- XP 纯函数
- Mastery eligibility
- invariant graders
- Harness runner wrapper

当前官方支持常规 test/expect 测试与 CLI 执行，因此这里不需要自造测试框架。

推荐：

```bash
pnpm add -D vitest
```

package：

```json
{
  "scripts": {
    "test": "vitest run",
    "harness:deterministic": "vitest run harness/tests/deterministic.test.ts"
  }
}
```

---

# 25. Harness Test Wrapper

例如：

```ts
import { describe, expect, test } from "vitest";
import { runXpCases } from "../runners/deterministic";

describe("Growth Harness", async () => {
  const results = await runXpCases();

  for (const result of results) {
    test(result.id, () => {
      expect(result.errors).toEqual([]);
      expect(result.passed).toBe(true);
    });
  }
});
```

---

# 26. Layer 3 — LLM Eval Harness

这一层测试：

> AI 的“语义判断”有没有漂移。

它不是测试最终 XP 数字。

测试对象：

```text
Activity Parser
Activity Evaluator
Mastery Verifier
Next Quest
Weekly Reviewer
```

---

# 27. 为什么 LLM Harness 不能只用 Exact Match

同一个正确判断可能表述不同。

所以 LLM Eval 要分：

```text
Hard constraints
Soft constraints
Semantic quality
```

---

# 28. LLM Hard Constraints

必须精确满足：

```text
JSON schema valid
Evidence range valid
Mastery range valid
confidence valid
verification_required present
no SQL
no direct permanent mutation
```

任何一项违反：

> FAIL。

---

# 29. LLM Behavioral Constraints

例如：

Case：

```text
“今天看论文两小时，我觉得自己完全会了。”
```

Expected：

```text
evidence <= E2
proposedMastery <= M4
verificationRequired = true for high claim
```

这些可以自动判断。

---

# 30. LLM Semantic Rubric

部分输出不能完全规则判断，例如：

> Next Quest 是否真的有价值？

可采用第二层 Grader。

但第一版建议：

> **优先人工 golden labels + rule graders。**

不要立即搞“一个 AI 给另一个 AI 打分”作为唯一判断。

---

# 31. LLM Case 格式

```json
{
  "id": "llm-assessment-001",

  "input": {
    "rawInput": "今天读了两个小时论文，我已经完全掌握PGLS。"
  },

  "context": {
    "currentMastery": 1,
    "previousEvidence": 0
  },

  "expected": {
    "evidence": {
      "max": 2
    },
    "mastery": {
      "max": 4
    },
    "verificationRequired": true
  }
}
```

---

# 32. LLM Runner

创建：

```text
harness/runners/llm.ts
```

概念：

```ts
import OpenAI from "openai";
import { AssessmentSchema } from "@/lib/ai/schemas";

const client = new OpenAI();

export async function runAssessmentCase(testCase: AssessmentCase) {
  const response = await runActivityAssessment({
    rawInput: testCase.input.rawInput,
    context: testCase.context,
  });

  const parsed = AssessmentSchema.parse(response);

  return gradeAssessment(testCase, parsed);
}
```

注意：

> Harness 必须调用产品实际的 `runActivityAssessment()`，而不是复制一套 Prompt。

否则测试的是“另一套系统”。

---

# 33. LLM Harness 必须固定什么

每次结果记录：

```text
model
prompt_version
rules_version
timestamp
case_id
output
grader_result
latency
token usage
```

这样模型升级后可以比较。

---

# 34. Snapshot 不等于 Golden Truth

不要把一次模型输出整个保存成 snapshot，然后要求以后逐字相同。

错误：

```text
output text 必须完全一致
```

正确：

> 保留结构性行为约束。

例如：

```text
Evidence 不得 > 2
必须 verification
不能直接 Mastery M7
```

---

# 35. 模型升级测试

每次准备：

```text
model A → model B
```

必须跑全部 LLM Harness。

比较：

```text
pass rate
hard violation count
mastery inflation rate
evidence inflation rate
average confidence
cost
latency
```

---

# 36. Prompt 改动测试

Prompt 修改前：

```bash
pnpm harness:llm -- --baseline
```

修改后：

```bash
pnpm harness:llm
```

报告：

```text
Before pass rate: 96%
After pass rate: 92%

Regression:
M-001
AF-004
```

如果关键 Case regression：

> 不允许 merge。

---

# 37. 不建议把 OpenAI Evals 作为唯一 Harness

截至本规范编写时，OpenAI 官方正在迁移旧 Evals platform，并建议新的评估工作考虑 Datasets 等工具。

因此本项目原则：

```text
Local Harness = source of truth

OpenAI hosted evaluation tools
= optional auxiliary
```

原因：

- 不绑定单个平台生命周期
- 可测试确定性 Growth Engine
- 可在 CI 中直接执行
- 可针对产品自己的数据库状态做断言

---

# 38. LLM Eval 数据隐私

Harness Case 应尽量：

> synthetic / anonymized。

不要把用户的真实私人日记直接提交到公共测试集。

真实线上失败案例进入 Harness 时：

1. 去身份化
2. 删除具体私人信息
3. 保留行为模式
4. 再作为 regression case

---

# 39. Online Failure → Regression Case

这是 Harness 最重要的成长机制。

例如线上发现：

> AI 把“读完文章”判成 E4。

修复之后：

必须新增：

```text
llm-evidence-reading-only-007.json
```

这样以后永远防止该 bug 回来。

原则：

> **每个重要 AI bug 最终都应该变成一个 Case。**

---

# 40. Layer 4 — E2E Harness

负责：

> 浏览器里的真实用户流程是否正常。

采用 Playwright。

官方 Playwright 提供：

- browser automation
- assertions
- isolated browser contexts
- traces

非常适合测试核心 Growth Loop。

---

# 41. E2E 最重要的 Case

```text
Login
↓
Quick Log
↓
Activity saved
↓
AI Proposal
↓
Confirm
↓
XP Ledger
↓
Skill updated
↓
Dashboard reflects change
↓
History visible
```

---

# 42. Playwright 不测试 LLM 随机质量

E2E 默认：

> Mock AI response。

否则 CI：

- 贵
- 慢
- 不稳定

Playwright 主要测试：

> App workflow。

LLM 行为由：

```text
LLM Eval Harness
```

负责。

---

# 43. 真实 LLM E2E

可以建立少量：

```text
@live-ai
```

测试。

只在：

- 手动
- nightly
- model upgrade

运行。

不在每个 commit 都跑。

---

# 44. Playwright 推荐标签

概念：

```text
@smoke
@growth-loop
@security
@live-ai
```

CI：

```text
PR:
@smoke + @growth-loop

Nightly:
all + @live-ai
```

---

# 45. Harness 运行层级

推荐三档：

## Fast

```bash
pnpm harness:fast
```

执行：

- deterministic
- schemas
- invariant
- unit

目标：

> 秒级～短时间。

## Standard

```bash
pnpm harness
```

执行：

- Fast
- mock E2E
- selected LLM cases

## Full

```bash
pnpm harness:full
```

执行：

- all deterministic
- all LLM
- all E2E
- model comparison
- report

---

# 46. 推荐 package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",

    "harness:deterministic": "vitest run harness/tests/deterministic.test.ts",

    "harness:llm": "tsx harness/runners/llm.ts",

    "harness:e2e": "playwright test --grep @growth-loop",

    "harness:fast": "pnpm test && pnpm harness:deterministic",

    "harness": "pnpm harness:fast && pnpm harness:e2e",

    "harness:full": "pnpm harness:fast && pnpm harness:llm && playwright test",

    "harness:report": "tsx harness/report.ts"
  }
}
```

具体实现可根据项目调整。

---

# 47. 需要安装的开发依赖

若当前项目尚未安装：

```bash
pnpm add -D vitest
pnpm add -D @playwright/test
pnpm add -D tsx
```

然后：

```bash
pnpm exec playwright install
```

安装前应以当时官方稳定版文档为准。

---

# 48. Harness Report

每次运行输出：

```text
Growth Harness v0.1

Deterministic
42 / 42 PASS

Mastery
18 / 18 PASS

Anti-farming
16 / 16 PASS

LLM Assessment
37 / 40 PASS

Critical violations
1

Regression
- llm-assessment-013

Latency
p50 1.8 s
p95 3.7 s

Estimated LLM cost
...
```

---

# 49. Critical vs Non-critical

不是所有失败同级。

## Critical

出现以下任意：

```text
AI grants M6 with E0
repeated confirm adds XP twice
User A accesses User B
time XP becomes linear
AI writes ledger directly
```

结果：

> Harness overall FAIL。

## Major

例如：

```text
Next Quest quality regression
confidence calibration drift
```

需要审查。

## Minor

例如：

```text
文案变化
non-critical ordering
```

可以记录但不阻塞。

---

# 50. Harness Gate

CI 必须建立规则：

```text
Critical failure > 0
→ merge blocked

Deterministic pass rate < 100%
→ merge blocked

RLS fail
→ merge blocked

LLM eval pass rate below threshold
→ merge blocked / manual review
```

---

# 51. CI — GitHub Actions

建议：

```text
.github/workflows/quality.yml
```

概念：

```yaml
name: Quality

on:
  pull_request:
  push:
    branches: [main]

jobs:
  deterministic:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint
      - run: pnpm test
      - run: pnpm harness:deterministic
      - run: pnpm build
```

注意：

> Node 版本应与项目实际版本统一，不要机械照抄本文示例。

---

# 52. LLM Harness 不一定每个 PR 全跑

原因：

- 有 API 成本
- 网络依赖
- 模型存在非零波动

推荐：

```text
Every PR:
deterministic + mock E2E

Important Prompt PR:
selected LLM eval

Nightly:
full LLM eval

Before Model Upgrade:
full model comparison
```

---

# 53. Nightly Workflow

可单独：

```text
.github/workflows/nightly-evals.yml
```

执行：

```text
harness:full
```

失败：

- 保存 report artifact
- 创建 issue（后期）
- 或通知开发者

---

# 54. Baseline

Harness 必须保存一个批准基线：

```text
harness/baselines/
```

例如：

```json
{
  "promptVersion": "activity-evaluator-v0.3",
  "model": "configured-model",
  "passRate": 0.96,
  "criticalViolations": 0
}
```

---

# 55. Baseline 更新规则

禁止：

> 测试失败 → 直接更新 baseline 让它通过。

Baseline 只能在：

1. 明确规则变化
2. 人工审查
3. Spec 已更新
4. rules / prompt version 已升级

后更新。

---

# 56. Golden Cases

标记最关键的“宪法级案例”：

```text
golden = true
```

例如：

- 时间不能刷 XP
- E0 不能 M6
- XP != Mastery
- Failure 可以 Learning
- Confirm 必须幂等
- 不扣永久 XP 作为惩罚

Golden Case：

> 任何一个失败都直接阻断发布。

---

# 57. Harness Case 数量

第一版不需要 500 条。

建议：

```text
XP                   10
Mastery              10
Evidence              8
Anti-farming         10
Failure               5
Next Quest            5
Review                5
Security              5
```

总计：

> 约 50–60 个高价值 Case。

比 500 个低质量测试更有价值。

---

# 58. Case 来源

优先顺序：

```text
1. Growth Constitution
2. 已知边界情况
3. 实际使用中出现的 bug
4. 可能被 exploit 的方式
5. 模型升级风险
```

---

# 59. 第一批 Golden Cases

建议固定以下：

```text
G001_TIME_NOT_XP
G002_XP_NOT_MASTERY
G003_E0_NOT_HIGH_MASTERY
G004_REPEAT_DECAY
G005_REPEAT_BREAKTHROUGH_REWARDED
G006_FAILURE_CAN_LEARN
G007_NO_PERMANENT_PUNISHMENT
G008_MAIN_QUEST_NOT_FARMABLE
G009_CONFIRM_IDEMPOTENT
G010_AI_NO_DIRECT_DB_MUTATION
G011_USER_DATA_ISOLATION
G012_UNCERTAINTY_MUST_SURFACE
```

---

# 60. AGENTS.md 与 Harness 联动

AGENTS.md 必须要求 Coding Agent：

任何修改以下文件：

```text
src/lib/growth-engine/*
src/lib/ai/prompts/*
src/lib/ai/schemas/*
supabase/migrations/*
```

完成前必须运行相应 Harness。

例如：

```text
growth-engine change
→ harness:deterministic

prompt change
→ harness:llm

schema / RLS change
→ security + e2e
```

---

# 61. Pre-commit 是否跑 Harness

不建议把所有 Harness 放 pre-commit。

否则开发体验很差。

建议：

```text
pre-commit:
lint / format / fast unit

pre-push:
optional harness:fast

CI:
full deterministic gate
```

---

# 62. 线上数据反馈闭环

产品上线后记录：

```text
AI proposal
user confirmed?
user edited?
edited fields?
verification passed?
```

可统计：

```text
AI confirmation rate
Mastery overrule rate
Evidence correction rate
```

这些指标帮助判断 Harness 缺什么 Case。

---

# 63. AI Accuracy 指标

可以定义：

```text
Proposal Acceptance Rate

Evidence Agreement Rate

Mastery Agreement Rate

User Edit Rate

Critical Overestimation Rate
```

特别关注：

> **高估率**。

因为此系统里：

> 把 M4 低估为 M3

通常比：

> 把 M2 高估为 M6

危害小得多。

---

# 64. Asymmetric Error Cost

Harness 应体现：

```text
Mastery false positive
>
Mastery false negative
```

高 Mastery 宁可略保守。

因此 Grader 可配置：

```text
overestimation penalty > underestimation penalty
```

---

# 65. Confidence Calibration

后续积累数据后，可以检查：

AI 说：

```text
confidence = 0.9
```

的判断，是否真的大约 90% 被用户确认。

如果：

```text
0.9 confidence
但只有 55% 用户接受
```

说明 AI 严重过度自信。

这可以成为后续 Harness / analytics 项目。

---

# 66. Harness 不应该测试用户“是否上瘾”

系统目标是可持续成长，而不是依赖。

Harness 关注：

- 是否能产生下一步欲望
- 是否真实反馈成长
- 是否避免有害行为

不设：

```text
session length must increase
daily opens must increase
```

这种目标。

---

# 67. 游戏机制 Harness

可以加入行为规则测试。

例如：

```text
Rest Day
→ 不允许被判为 Failure

Streak broken
→ 不删除永久成长

Maintenance spam
→ 不应快速推高 Player Level
```

---

# 68. Player Level Harness

测试：

```text
Knowledge 90
Body 5
Life 7
Execution 9
```

Expected：

> Player Level 受到 Soft Cap。

防止单属性带飞。

---

# 69. Knowledge Graph Harness

AI 提议关系：

```text
A causes B
```

如果没有依据：

Expected：

```text
ai_inferred = true
verified = false
confidence < threshold
```

禁止直接保存为强事实。

---

# 70. Artifact Harness

输入：

```text
“我今天想了一个想法”
```

不能自动：

```text
Artifact created
```

而：

```text
形成一份可复用 SOP
```

可以。

---

# 71. Next Quest Harness

Case 要避免：

```text
只推荐最容易获得 XP 的任务。
```

应该检查：

- Goal Alignment
- Skill Gap
- Prerequisites
- Energy
- Recent repetition

---

# 72. Review Harness

Weekly Review 固定 Case：

用户一周：

```text
大量 Knowledge XP
几乎无 Body / Life
睡眠不足
```

Expected：

> Reviewer 应识别偏科与恢复需求。

而不是：

> “太棒了，继续加倍学习！”

---

# 73. Harness 的开发顺序

## Phase H0

创建：

```text
AGENTS.md
harness/README.md
package scripts
```

## Phase H1

实现：

```text
deterministic XP cases
mastery cases
anti-farming cases
```

## Phase H2

接入：

```text
LLM assessment cases
```

## Phase H3

接入：

```text
Playwright Growth Loop
```

## Phase H4

加入：

```text
GitHub Actions
baseline
report
```

## Phase H5

上线后：

```text
real failure → anonymized regression case
```

---

# 74. 第一版 Harness 开发任务

可以直接让 Coding Agent 执行：

```text
Task H0-H1

1. 创建 AGENTS.md
2. 创建 harness 目录
3. 创建 Zod case schemas
4. 创建 deterministic runner
5. 添加 12 个 Golden Cases
6. 用 Vitest 跑 Harness
7. package.json 加 harness scripts
8. GitHub Actions 加 deterministic gate
9. README 说明如何新增 Case
10. 不接 OpenAI API
```

完成后再做 H2。

---

# 75. 第二版 Harness 开发任务

```text
Task H2

1. 复用产品真实 Assessment function
2. 创建 synthetic LLM cases
3. Structured Output validation
4. 建立 behavioral graders
5. 保存 model/prompt/rules metadata
6. 输出 JSON + Markdown report
7. 增加 selected LLM eval script
8. API key 不进入前端
```

---

# 76. Harness README 必须教开发者什么

至少：

```text
Harness 解决什么
怎样运行
怎样新增 Case
Case 格式
Golden Case 规则
Baseline 怎么更新
失败怎么 debug
什么时候必须运行 LLM eval
```

---

# 77. 一个 Case 的生命周期

```text
发现 bug
↓
复现
↓
创建 Case
↓
确认 Case 在旧版本失败
↓
修改代码 / Prompt
↓
Case 通过
↓
进入 regression suite
↓
以后永久保留
```

这是最重要的 Harness 工作流。

---

# 78. Debug Report

失败时不要只显示：

```text
FAIL
```

应显示：

```text
Case:
G003_E0_NOT_HIGH_MASTERY

Expected:
mastery <= M3

Actual:
M6

Model:
...

Prompt:
activity-evaluator-v0.4

Rules:
growth-engine-v0.2

Output:
...

Violation:
HIGH_MASTERY_WITH_LOW_EVIDENCE
```

---

# 79. LLM 输出保存

CI 中：

- 成功 case 可以只保摘要
- 失败 case 保存完整结构化输出

注意：

> 不保存真实用户敏感原文。

---

# 80. Harness 成本控制

LLM Suite 可分：

```text
golden
core
extended
```

例如：

```bash
pnpm harness:llm:golden
pnpm harness:llm:core
pnpm harness:llm:full
```

PR 只跑 golden/core。

Nightly 跑 full。

---

# 81. Randomness

LLM 天然存在一定非确定性。

因此单次失败不一定就是 regression。

对关键软 Case 可以：

```text
run 3 times
pass >= 2
```

但：

> Hard schema / safety invariant 一次违反就算失败。

---

# 82. 不允许“通过多跑几次直到通过”

禁止 CI：

```text
失败
→ 一直 rerun
→ 总有一次通过
```

这会掩盖模型不稳定。

重跑策略必须固定。

---

# 83. Harness 数据版本

每个 Case 可带：

```text
caseVersion
introducedIn
ruleVersion
```

例如：

```json
{
  "caseVersion": 1,
  "introducedIn": "0.2.0",
  "ruleVersion": "growth-engine-v0.1"
}
```

---

# 84. Harness 与 Rules Version

若 Growth Constitution 真正修改：

Case 可能需要更新。

但必须：

```text
先改 spec
↓
bump rules version
↓
修改 case
↓
记录 changelog
```

不能：

> 因为 Case 不通过就偷偷放宽 Expected。

---

# 85. 推荐 Dashboard（开发者）

后期可以建立内部：

```text
/debug/harness
```

展示：

- Pass Rate
- Regression
- Mastery Inflation
- Evidence Inflation
- Model Cost
- Prompt Versions

生产环境普通用户不可见。

---

# 86. Harness 完成标准

当以下条件成立，可以认为 Harness v1 可用：

- [ ] 根目录 AGENTS.md 生效
- [ ] 12 个 Golden Cases
- [ ] deterministic runner
- [ ] Vitest 集成
- [ ] LLM Structured Eval
- [ ] Playwright Growth Loop
- [ ] CI gate
- [ ] report
- [ ] baseline
- [ ] 每个重要 bug 能快速转成 Case

---

# 87. 当前阶段的推荐

在产品正式 MVP 开发时：

**先搭 H0 + H1。**

也就是：

```text
AGENTS.md
+
Deterministic Harness
+
Golden Cases
+
CI
```

然后继续 Growth Loop。

当：

```text
Activity → AI Proposal
```

真正接入后，再做 H2 LLM Harness。

这样不会过度工程化。

---

# 88. 最终原则

Harness 的目的不是让测试数量变多。

而是保护：

> **“这个系统为什么存在。”**

它最终必须能回答：

```text
代码有没有坏？
AI 有没有漂？
XP 有没有通胀？
Mastery 有没有虚高？
用户能不能刷分？
系统有没有背离 Growth Constitution？
```

只要 Harness 能稳定回答这些问题，它就是成功的。
