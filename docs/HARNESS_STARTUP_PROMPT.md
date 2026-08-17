# Harness 搭建启动提示词

你现在负责为 AI Personal Growth RPG 搭建第一版 Harness。

开始前完整阅读：

- AGENTS.md
- docs/01_SYSTEM_RULES.md
- docs/03_TECHNICAL_IMPLEMENTATION.md
- docs/05_AI_GAME_MASTER_CONTRACT.md
- docs/08_TESTING_EVALS_AND_QA.md
- docs/10_HARNESS_ARCHITECTURE_AND_IMPLEMENTATION.md

当前只实现 **Harness H0 + H1**。

IN SCOPE：

1. 根目录 AGENTS.md（如已有则检查，不随意覆盖）
2. `harness/` 目录
3. Zod Case Schema
4. deterministic runner
5. 至少 12 个 constitution-level Golden Cases
6. XP / Mastery / anti-farming invariant graders
7. Vitest 集成
8. package scripts
9. deterministic CI gate
10. Harness README

OUT OF SCOPE：

- 不接真实 OpenAI API
- 不做多 Agent 编排
- 不做 hosted eval platform 绑定
- 不做 UI
- 不修改 Growth Constitution
- 不重构与 Harness 无关的业务代码

重要要求：

- Harness 必须调用项目真实 Growth Engine，而不是复制一份 XP 逻辑。
- 如果 Growth Engine 尚未实现，先创建接口和 failing/placeholder cases，但不要伪造“测试已通过”。
- Golden Case 失败不得通过修改 baseline 掩盖。
- Case 应优先测试 invariant，而不是全部锁死精确 XP。
- 每个修改都应小而可测试。

完成前运行：

```bash
pnpm lint
pnpm test
pnpm harness:deterministic
pnpm build
```

最后报告：

- 创建/修改文件
- Golden Cases 列表
- 测试结果
- 尚未接入的部分
- H2（LLM Eval Harness）的下一最小步骤
