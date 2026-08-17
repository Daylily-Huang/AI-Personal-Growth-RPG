# AI Personal Growth RPG — UI Design System 与组件规范

> 版本：v0.1  
> 产品气质：专业成长仪表盘 + 克制的 RPG 角色菜单。

---

# 1. 视觉目标

应体现：

```text
Progress
Discovery
Structure
Capability
Calm Immersion
```

不应体现：

```text
手游商城
儿童打卡
赌博
花哨社交
过度庆祝
```

---

# 2. 默认主题

首版：

> Dark-first，支持未来 Light Theme。

视觉关键词：

- 深色中性背景
- 高对比文字
- 少量强调色
- 图谱节点轻微发光
- 卡片层级清晰
- 数据密度适中

---

# 3. Design Tokens

不要在组件中散落大量硬编码颜色。

至少定义：

```text
background
surface-1
surface-2
border
text-primary
text-secondary
text-muted

accent
success
warning
danger
info

xp
mastery
knowledge
quest
artifact
state
```

注意：

> 状态不能仅靠颜色表达。

---

# 4. Typography

推荐层级：

```text
Display
H1
H2
H3
Body
Small
Mono / Numeric
```

数字区域如：

```text
XP
Level
Progress
Confidence
```

应使用稳定的数字排版，避免跳动明显。

---

# 5. Spacing

统一 4/8px 系列。

示意：

```text
4
8
12
16
24
32
48
64
```

不要每个页面自行发明间距。

---

# 6. Layout

Desktop：

```text
Left Navigation
+
Main Content
+
Context Panel（可选）
```

Mobile：

```text
Bottom Navigation
+
Floating Quick Log
```

---

# 7. 一级导航

Desktop：

```text
Dashboard
Quests
Skills
Knowledge
Artifacts
Activity
Reviews
Game Master
```

Mobile：

```text
Home
Quest
+
World
Me
```

---

# 8. 核心组件

必须形成可复用组件：

```text
PlayerHeader
XpProgress
StateMeter
QuestCard
BossCard
SkillNode
KnowledgeNode
ArtifactCard
GrowthEvent
MasteryBadge
EvidenceBadge
ConfidenceIndicator
AssessmentProposal
QuickLogComposer
ReviewSummary
```

---

# 9. Mastery 视觉

不要只用百分比。

优先显示：

```text
M4 Explain
```

旁边可显示：

```text
Confidence 78%
```

Mastery 与 Confidence 必须视觉上分开。

---

# 10. Evidence 视觉

例如：

```text
E2
Correct Explanation
```

用户 hover / click：

> 显示判定理由。

---

# 11. XP 动画

规则：

- 0.3–1.5 秒
- 可跳过
- 不阻塞
- 不叠多层 modal

真正 Level Up 才使用更明显动画。

---

# 12. Growth Feedback 组件

Confirm 后：

```text
QUEST COMPLETE

+28 XP

Mastery
M3 → M4

Knowledge
+1 node

Artifact
LC Notes v1.0

Next Unlock
LC Simulation
```

必须同时体现：

> 数字 + 世界变化。

---

# 13. Dashboard 信息限制

首页最多：

- 1 Main Quest
- 1 Boss
- 1–3 Today Quest
- 3 transient states
- 3–5 Recent Growth

不要把所有统计图塞首页。

---

# 14. Skill Tree 节点状态

```text
Locked
Available
Learning
Mastered
Advanced
```

还应体现：

- selected
- prerequisite missing
- confidence low
- recall due

---

# 15. Knowledge Map 节点状态

视觉上区分：

```text
Verified
AI Inferred
Low Confidence
Unknown / Locked
```

---

# 16. Empty State

不能只写：

> No data.

例如 Skill Tree 为空：

> “还没有技能节点。完成第一次 Growth Assessment 后，系统会根据真实行为建立技能树。”

---

# 17. Loading

AI Assessment 必须显示阶段性状态：

```text
Reading activity
Finding related skills
Evaluating evidence
Preparing proposal
```

但不假装输出虚假的内部推理。

---

# 18. Error

区分：

- Activity 已保存，AI 评估失败
- 数据库保存失败
- session 失效
- 图谱加载失败

用户必须知道：

> 数据有没有丢。

---

# 19. Accessibility

至少：

- WCAG 合理对比
- 键盘操作
- focus visible
- icon button aria-label
- graph node 可被键盘/列表替代访问
- 不只靠颜色表达 mastery/evidence/status

---

# 20. Responsive

必须重点检查：

```text
375px
768px
1280px+
```

Skill Tree / Knowledge Graph 在手机端可以切换：

```text
Graph
List
```

而不是强迫用户在窄屏操作巨型图谱。

---

# 21. 禁止 UI

禁止优先加入：

- 抽卡页
- 充值页
- 商城首页
- 连续签到弹窗
- 红点轰炸
- 全屏老虎机式奖励
- 强制分享
- 排行榜压迫

---

# 22. UI 验收问题

每个页面必须回答至少一个：

```text
我现在是什么状态？
我正在做什么？
我变强了什么？
我下一步做什么？
我的知识/能力世界如何变化？
```

无法回答任何一个的问题的组件，应考虑删除。
