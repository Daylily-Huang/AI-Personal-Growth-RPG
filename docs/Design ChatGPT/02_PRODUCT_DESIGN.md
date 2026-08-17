# AI Personal Growth RPG — 产品定位、页面设计与交互规范

> **版本：v0.1**
>
> 本文档用于定义 AI Personal Growth RPG 的产品形态、页面结构、信息架构、核心交互、视觉方向与 AI 介入方式。
>
> 本文档应与《AI Personal Growth RPG — 系统设定与规则规范》配套使用：
>
> - 《系统设定与规则规范》负责回答：**成长如何判断、XP 如何结算、Mastery 如何升级、什么允许、什么禁止**
> - 本文档负责回答：**产品以什么形式存在、页面如何组织、用户如何操作、AI 如何呈现这些规则**

---

# 1. 产品定位

## 1.1 产品本质

AI Personal Growth RPG 不是：

- 普通待办清单
- 打卡软件
- 番茄钟
- 单纯习惯追踪器
- 单纯 AI 聊天机器人
- 传统知识管理工具
- 单纯 RPG 外壳

它本质上是：

> **一个以现实行为为输入、以真实成长为核心状态、以 AI 为 Game Master、以技能树和知识世界为可视化载体的个人成长操作系统。**

---

## 1.2 推荐产品形态

第一版正式产品推荐：

> **Web App + PWA**

理由：

- 电脑端适合复杂信息展示
- 手机端适合快速记录
- 易于快速迭代
- 不需要一开始开发原生 App
- 后续可逐步接入：
  - 日历
  - Zotero
  - GitHub
  - 运动数据
  - 健康数据
  - 阅读记录
  - 文件系统
  - 浏览器扩展

最终可以演化为：

> **Personal Growth OS**

---

# 2. 核心产品理念

用户每天进入系统后，应该首先感受到：

> “我现在这个角色是什么状态？”

其次是：

> “我下一步最值得做什么？”

最后是：

> “今天之后，我具体变强了什么？”

因此产品的信息优先级必须是：

```text
当前状态
>
主线目标
>
下一行动
>
成长反馈
>
历史数据
>
装饰性游戏元素
```

---

# 3. 产品核心角色

系统中存在三个主体。

## 3.1 Player

现实中的用户本人。

角色数据必须来自现实行为，而不是虚拟操作。

---

## 3.2 AI Game Master

AI 负责：

- 理解用户的自然语言输入
- 判断任务类型
- 评估成长
- 更新技能树
- 更新知识图谱
- 生成下一步
- 发现能力突破
- 检测刷分
- 进行每日 / 每周 / 每月复盘

AI 不应该只是聊天窗口。

它是整个系统的：

> **解释层 + 判定层 + 教练层 + 世界管理器。**

---

## 3.3 Growth World

系统中的所有：

- Quest
- Skill
- Knowledge
- Artifact
- Boss
- Achievement
- Discovery

共同构成用户的“成长世界”。

---

# 4. 核心用户体验闭环

标准流程：

```text
用户完成现实行动
↓
快速记录
↓
AI 解析
↓
AI 判断成长与证据
↓
用户确认或修正
↓
系统更新：
XP / Mastery / Skill / Knowledge / Quest / Artifact
↓
展示成长反馈
↓
生成 Next Quest
↓
回到现实
```

系统应做到：

> **记录成本尽可能低，反馈价值尽可能高。**

---

# 5. 首屏 Dashboard 定位

Dashboard 是整个系统最重要的页面。

它回答：

> **“我现在是什么状态？”**

以及：

> **“我现在最应该做什么？”**

---

# 6. Dashboard 页面结构

推荐结构：

```text
┌──────────────────────────────────────────────┐
│ PLAYER                                    ⚙ │
│ Lv. 18                                      │
│ XP 1840 / 2200                              │
│ Momentum 78   Energy 64   Focus 82          │
├──────────────────────────────────────────────┤
│ TODAY                                        │
│                                              │
│ 主线任务                                     │
│ [完成 LC 方法阅读]          60%              │
│                                              │
│ Next Best Action                             │
│ “完成 LC simulation 部分”                   │
├──────────────────────────────────────────────┤
│ MAIN QUEST                                   │
│ 硕士毕业                                     │
│ █████████████░░░░░░░ 54%                    │
│                                              │
│ BOSS                                         │
│ 硕士论文答辩                                 │
├──────────────────────┬───────────────────────┤
│ Skill Growth         │ Knowledge Growth      │
│ Molecular Ecology   │ +3 nodes              │
│ R                    │ +5 connections        │
│ Academic Writing     │ 1 new area            │
├──────────────────────┴───────────────────────┤
│ RECENT GROWTH                                │
│ Mastery upgraded: LC M3 → M4                 │
│ Artifact acquired: LC 方法笔记 v1.0          │
├──────────────────────────────────────────────┤
│ AI GAME MASTER                              │
│ 今天做了什么？                               │
│ [ 输入自然语言……                         ]   │
└──────────────────────────────────────────────┘
```

---

# 7. Dashboard 的核心模块

## 7.1 Player Header

显示：

- Player Level
- 总 XP
- 当前等级进度
- Momentum
- Energy
- Focus
- 可选 Avatar

要求：

- 简洁
- 不显示过多指标
- 只展示最重要状态

---

## 7.2 Today Panel

显示：

- 今日核心任务
- 今日推荐行动
- 今日已获得 XP
- 今日完成 Quest 数量
- 今日状态

Today Panel 的目标不是：

> 塞满任务。

而是：

> **让用户知道今天最值得推进什么。**

---

## 7.3 Main Quest Panel

显示：

- 当前人生主线
- 当前章节
- 阶段进度
- 最近里程碑
- 下一个关键节点

例如：

```text
MAIN QUEST

完成硕士毕业论文

54%

Current Chapter
Methods

Next Milestone
完成个体识别方法部分
```

---

## 7.4 Boss Panel

Boss 必须是现实中的重要节点。

例如：

- 答辩
- 考试
- 投稿
- 面试
- 比赛
- 马拉松
- 产品发布

Boss 不能被无关行为推进。

---

## 7.5 Recent Growth

这一模块必须突出：

> **“最近我具体变强了什么？”**

例如：

```text
Mastery Upgrade
Likelihood Clustering
M3 Recall → M4 Explain

Skill Level Up
R
Lv.14 → Lv.15

New Artifact
《PCR 抑制排查流程 v1.0》
```

---

# 8. Quest 页面

Quest 页面回答：

> **“我正在完成什么人生目标？”**

它不是 Todo List。

而是：

> **目标树。**

---

# 9. Quest 信息层级

建议：

```text
Main Quest
↓
Epic Quest
↓
Major Quest
↓
Standard Quest
↓
Minor Quest
↓
Micro Quest
```

示例：

```text
MAIN QUEST
硕士毕业

├── EPIC QUEST
│   Introduction
│
│   ├── MAJOR QUEST
│   │   完成研究背景
│   │
│   └── MAJOR QUEST
│       完成方法综述
│
└── EPIC QUEST
    Individual Identification

    ├── LR
    ├── LC
    └── Capwire
```

---

# 10. Quest 卡片应显示

每个 Quest 至少显示：

- 名称
- 类型
- 所属 Main Quest
- Quest Size
- 难度
- 当前进度
- Goal Alignment
- 前置任务
- 对应 Skill
- 预计成长方向
- 是否产生 Artifact
- 是否存在 Deadline
- 是否是 Boss 前置

---

# 11. Quest 状态

建议：

```text
Locked
Available
Active
Paused
Completed
Failed
Archived
```

其中：

- Failed 不等于删除
- Failed 可以产生 Learning XP
- Archived 表示不再继续，但保留历史

---

# 12. Quest 创建方式

支持三种方式。

## 12.1 用户主动创建

例如：

> “我要学会 PGLS。”

AI 自动拆解。

---

## 12.2 AI 建议

根据：

- 当前目标
- Skill Gap
- Knowledge Gap
- Deadline
- Energy
- Momentum

生成 Next Quest。

---

## 12.3 系统触发

例如：

> 某 Mastery Confidence 降低

生成：

> Recall Quest

---

# 13. Skill Tree 页面

Skill Tree 回答：

> **“我会什么？”**

它是整个系统最重要的长期成长可视化之一。

---

# 14. Skill Tree 层级

建议：

```text
Domain
↓
Skill Cluster
↓
Skill
↓
Subskill
```

例如：

```text
Research

├── Molecular Ecology
│   ├── DNA Extraction
│   ├── Microsatellite
│   │   ├── Genotyping
│   │   ├── Error Detection
│   │   └── Individual Identification
│   │       ├── MM
│   │       ├── LR
│   │       └── LC
│   └── DNA Metabarcoding
│
└── Statistics
    ├── Regression
    ├── GLMM
    └── PGLS
```

---

# 15. Skill Node 页面

点击一个技能后展示：

```text
Likelihood Clustering

Level
Lv.12

Mastery
M4 Explain

Confidence
78%

Evidence
E2

XP
620 / 800

Last Used
3 days ago

Related Artifacts
- LC 方法笔记 v1.0

Prerequisites
- LR
- Genotyping Error

Next Unlock
LC Simulation Validation
```

---

# 16. Skill Tree 视觉原则

应采用：

- 节点
- 连线
- 解锁状态
- Mastery 状态
- 等级进度

建议视觉状态：

```text
Locked
Dimmed

Available
Outlined

Learning
Partially Filled

Mastered
Filled

Advanced
Highlighted
```

禁止：

- 所有技能一次性全部显示
- 画面过度复杂
- 数百节点全部同时展开

需要支持：

- 缩放
- 折叠
- 分领域查看
- 搜索

---

# 17. Knowledge Map 页面

Knowledge Map 回答：

> **“我知道什么，以及这些东西是怎么连接的？”**

它和 Skill Tree 必须分开。

Skill Tree：

> 能力结构。

Knowledge Map：

> 认知结构。

---

# 18. Knowledge Graph 节点

节点包括：

- 概念
- 理论
- 方法
- 人物
- 论文
- 模型
- 机制
- 框架
- 数据
- 实验现象

---

# 19. Knowledge Graph 关系

关系包括：

```text
is_a
part_of
causes
depends_on
contrasts_with
supports
applies_to
derived_from
related_to
evidence_for
```

AI 不得无依据随意建立关系。

---

# 20. Knowledge Map 交互

用户应可以：

- 缩放
- 拖动
- 搜索节点
- 查看一个领域
- 查看最近新增
- 查看薄弱节点
- 查看未知区域
- 点击节点进入详情

---

# 21. Knowledge Node 详情

建议显示：

```text
Likelihood Clustering

Domain
Molecular Ecology

Mastery
M4 Explain

Confidence
78%

Evidence
E2

Sources
- Paper A
- Paper B

Connections
→ Genotyping Error
→ LR
→ ADO

Artifacts
- LC 解析笔记

Last Reviewed
3 days ago
```

---

# 22. Discovery 页面 / 模式

Discovery 的作用不是展示“已知”。

而是展示：

> **“还有什么值得探索？”**

例如：

```text
Current Region
Molecular Ecology

Explored
67%

Known Nodes
42

Unknown Connections
???

Potential New Area
Spatial Capture-Recapture
```

---

# 23. Unknown Area 设计

可以存在：

```text
???
```

但 AI 不应人为制造毫无意义的神秘感。

未知区域必须：

- 与当前知识相关
- 有真实学习价值
- 具有合理前置关系

---

# 24. Artifact 页面

Artifact 回答：

> **“我留下了哪些真正有用的东西？”**

这是系统区别于普通游戏化 App 的关键页面。

---

# 25. Artifact Library

推荐类型：

```text
Research
Code
Workflow
Protocol
Checklist
Template
Knowledge Card
Decision Framework
Writing
Dataset
Figure
Presentation
```

---

# 26. Artifact 卡片

显示：

- Artifact 名称
- 类型
- 创建时间
- 来源 Quest
- 对应 Skill
- 当前版本
- 使用次数
- 最近修改
- 复用价值

---

# 27. Artifact 的升级机制

Artifact 本身也可以版本化。

例如：

```text
PCR 抑制排查流程

v1.0
↓
v1.1
↓
v2.0
```

Artifact 升级可以带来：

- Skill XP
- Systemize Mastery
- Performance XP

---

# 28. Activity Log 页面

Activity Log 是整个系统的“事实数据库”。

它回答：

> **“过去到底发生了什么？”**

---

# 29. Activity Log 形式

推荐时间流：

```text
2026-08-17

14:20
Learning Quest
阅读 LC 方法

+28 XP
M3 → M4

12:10
Maintenance Quest
整理实验台

Life XP +4
Momentum +2

09:30
Production Quest
完成数据清洗脚本

Artifact Created
clean_genotype.R
```

---

# 30. Activity Log 必须支持

- 日期筛选
- 类型筛选
- Domain 筛选
- XP 筛选
- Artifact 筛选
- Quest 筛选
- 搜索

---

# 31. AI Game Master 页面

AI Game Master 是用户最主要的自然语言入口。

推荐它具有两个模式。

## 31.1 Quick Log

用于快速记录。

例如：

> “今天读了 2 小时文献，理解了 LR 和 LC 的区别。”

AI 返回结构化解析。

---

## 31.2 Deep Review

用于：

- 学习讨论
- 任务拆解
- 周复盘
- Mastery 验证
- 思考整理
- 系统优化

---

# 32. AI 输入后的交互流程

用户输入：

> 今天读了 Nielsen 2018，主要理解 metabarcoding 和显微镜方法的差异。

AI 不应立刻直接结算。

推荐流程：

```text
AI Parsed:

Quest Type:
Learning

Domain:
Molecular Ecology

Knowledge:
DNA Metabarcoding
Microscopy

Evidence:
E1–E2

Suggested XP:
22–30

Mastery Change:
Metabarcoding M2 → M3

Confidence:
71%

[Confirm]
[Edit]
[Verify Mastery]
```

---

# 33. Confirm 机制

AI 的判断必须允许用户：

- 确认
- 修改
- 补充证据
- 拒绝

禁止 AI 完全不可逆地修改长期数据。

---

# 34. Mastery Verification

当 AI 判断可能升级 Mastery 时，可触发：

```text
MASTERY CHECK
```

形式可以是：

- 简答
- 应用题
- 解释题
- 实际操作
- 上传成果
- 提供 Artifact

Mastery 越高，验证越严格。

---

# 35. Daily Review 页面

Daily Review 重点回答：

> **“今天我到底成长了什么？”**

推荐模块：

```text
Today

Growth XP
+124

Skills Improved
3

Knowledge Nodes
+5

Artifacts
+1

Main Quest Progress
+2.4%

Most Valuable Growth
理解 LC 模型假设

Low-value Time
42 min

Tomorrow Best Action
完成 simulation 部分
```

---

# 36. Weekly Review 页面

Weekly Review 不应只是统计图。

必须有 AI 分析。

建议包括：

## Weekly Character Growth

- 本周最大成长
- 最大突破
- 最重要 Artifact
- 最大问题
- 哪个领域偏科
- 哪类任务最有效
- 哪类活动低价值
- 是否需要调整 Quest
- 是否需要休息

---

# 37. Monthly Review 页面

Monthly Review 是“角色成长报告”。

例如：

```text
AUGUST 2026

PLAYER
Lv.18 → Lv.20

Molecular Ecology
+24%

Statistics
+8%

Body
+11%

Artifacts
+7

Knowledge Nodes
+42

Main Quest
41% → 54%
```

核心问题：

> **“一个月之后，我具体变成了一个怎样不同的人？”**

---

# 38. Profile 页面

Profile 应包含：

- Player Level
- 总 XP
- Core Attributes
- Main Quest
- Current Class / Role
- Achievements
- Long-term Stats

---

# 39. Character Class

可以允许 AI 根据长期行为形成动态职业标签。

例如：

```text
Researcher
Ecologist
Data Analyst
Runner
Writer
```

但不得强制用户绑定单一职业。

可以多职业并存。

---

# 40. Achievement 系统

Achievement 必须优先奖励真实里程碑。

例如：

```text
First Independent Analysis
First Published Paper
100 km Running
First Complete SOP
10 Verified Masteries
```

禁止：

- 打开 App 100 次
- 连续登录 30 天

作为核心 Achievement。

---

# 41. 首页导航建议

Desktop：

```text
Dashboard
Quests
Skills
Knowledge
Artifacts
Activity
Reviews
AI Game Master
```

Mobile：

```text
Home
Quest
+
World
Me
```

其中：

> “+”

作为快速记录入口。

---

# 42. Mobile Quick Log

手机端最核心功能：

> 10 秒完成记录。

例如点击：

```text
+
```

出现：

```text
What did you do?

[语音]
[文字]
[照片]
[文件]
```

AI 自动解析。

---

# 43. Desktop 定位

桌面端主要用于：

- 查看技能树
- 查看知识图谱
- 深度复盘
- 管理 Quest
- 编辑 Artifact
- 与 AI 深度讨论

---

# 44. 视觉定位

推荐整体视觉：

> **成熟、克制、具有 RPG 感，但不能像手游。**

应避免：

- 卡通化
- 过度二次元
- 大量彩色按钮
- 满屏金币
- 游戏商城感
- 幼稚称号

---

# 45. 推荐视觉关键词

```text
Dark Dashboard
Knowledge Graph
Skill Tree
Progressive Disclosure
Minimal RPG
Data Visualization
Professional
Immersive
Calm
```

---

# 46. 推荐视觉风格

可以采用：

- 深色背景
- 高对比文字
- 微发光节点
- 柔和进度条
- 少量强调色
- 玻璃化面板适量使用
- 大量留白

整体应更接近：

> 游戏中的角色菜单 + 科研仪表盘

而不是：

> 手游首页。

---

# 47. 游戏反馈动画

动画必须短。

例如：

```text
+28 XP
Skill Updated
New Node
Mastery Up
```

动画时间建议：

> 0.3–1.5 秒

禁止：

- 5 秒以上领奖动画
- 强制等待
- 多层弹窗
- 无法跳过动画

---

# 48. Notification 设计

通知应该用于：

- 重要 Quest
- Boss Deadline
- Recall Quest
- Weekly Review
- Recovery

禁止：

- 为提高打开率频繁通知
- “你已经 3 小时没打开 App”
- 羞辱式提醒

---

# 49. AI 自动化程度

系统建议采用：

> **AI 建议 + 用户确认**

而不是：

> AI 全自动修改一切。

适合自动处理：

- Activity 分类
- Skill 推荐
- Knowledge Node 推荐
- XP 初步建议

需要用户确认：

- 高 Mastery 升级
- Character 改变
- Main Quest 修改
- 删除历史数据
- 高影响评分

---

# 50. 数据来源优先级

未来可接入：

```text
Manual Input
AI Conversation
Calendar
Zotero
GitHub
Health
Running App
Files
Notes
Browser
```

但外部数据只能证明：

> “发生了行为。”

不能自动证明：

> “发生了理解。”

例如：

```text
Zotero opened paper
```

不能等于：

```text
Mastery +1
```

---

# 51. 自动记录原则

自动记录必须经过：

```text
Detected
↓
Interpreted
↓
Confirmed
↓
Scored
```

避免错误数据污染系统。

---

# 52. 搜索与全局命令

系统应支持类似 Command Palette：

```text
Ctrl + K
```

可输入：

```text
记录今天的学习
打开 LC
查看本周成长
创建 Quest
找到 PCR Artifact
```

---

# 53. Onboarding

第一次进入系统时，不应要求填写几十项信息。

只需要：

1. 当前主要目标
2. 目前最重要的成长方向
3. 当前身份 / 阶段
4. 想改善的问题
5. AI 通过对话逐步建立技能树

原则：

> **Progressive Profiling**

而不是一次性填完整个人档案。

---

# 54. 第一次使用体验

建议：

```text
Welcome

What are you currently trying to become better at?

用户回答

↓

AI 创建：

Main Quest
Initial Skills
Initial Knowledge Areas

↓

生成 Player Lv.1

↓

要求完成第一个现实 Quest
```

第一个任务必须简单、真实、可完成。

---

# 55. 数据可编辑性

所有关键 AI 判定都必须可追溯。

用户点击 XP 时应看到：

```text
Why did I get 28 XP?

Base        20
Difficulty  ×1.2
Evidence    ×1.1
Novelty     ×1.0
Alignment   ×1.05
```

不一定显示复杂数学，但必须能够解释。

---

# 56. 系统可解释性

任何：

- XP
- Mastery
- Level
- Quest 推荐
- Skill 推荐

都应支持：

> Why?

AI 必须能解释依据。

---

# 57. 防止 Dashboard 变成数据垃圾场

首页最多突出：

- 1 个 Main Quest
- 1–3 个 Today Quest
- 3 个临时状态
- 3–5 个近期成长

其他内容进入二级页面。

---

# 58. 不同时间尺度的产品体验

## 秒级

完成后：

```text
+XP
Node Updated
Quest Complete
```

## 日级

Daily Review。

## 周级

能力变化与效率复盘。

## 月级

Player Growth Report。

## 年级

Life Chapter。

---

# 59. Life Chapter

长期可以加入：

```text
CHAPTER

Master's Degree
2025–2027
```

完成后形成：

```text
Archived Chapter
```

记录：

- 最终等级
- 核心技能
- Artifact
- Boss
- 关键成长
- 失败
- 重要转折

形成真正的：

> 人生游戏存档。

---

# 60. 数据架构对应页面

建议核心实体：

```text
User
PlayerProfile
Attribute
Domain
Skill
KnowledgeNode
Quest
Activity
Artifact
MasteryRecord
XPTransaction
Evidence
StateSnapshot
Review
Achievement
```

---

# 61. 页面与实体映射

```text
Dashboard
→ PlayerProfile / State / Quest / XP

Quest
→ Quest / Activity

Skill Tree
→ Domain / Skill / Mastery

Knowledge
→ KnowledgeNode / Evidence

Artifact
→ Artifact

Activity
→ Activity / XPTransaction

Review
→ Review / StateSnapshot
```

---

# 62. 推荐 MVP 页面

第一版只做：

```text
1. Dashboard
2. Quest
3. Skill Tree
4. Knowledge Map
5. Activity Log
6. AI Game Master
7. Weekly Review
```

Artifact 可以先作为 Skill / Activity 的子页面。

---

# 63. MVP 不做

第一版禁止优先开发：

- 好友系统
- 排行榜
- 公会
- PVP
- 商城
- 付费抽奖
- 宠物
- 大量皮肤
- 复杂装备
- NFT
- 虚拟货币经济系统

这些都不是产品核心价值。

---

# 64. 产品成功标准

第一版最重要的问题：

> **用户是否会因为看到真实成长而主动再次回来？**

不是：

> 用户是否因为签到奖励回来。

---

# 65. MVP 的核心验证指标

建议观察：

- 用户是否愿意每天记录
- 记录是否低负担
- AI 判断是否可信
- Skill Tree 是否让用户产生升级欲
- Knowledge Map 是否产生探索欲
- Quest 是否帮助现实目标推进
- Weekly Review 是否真的有洞察
- 是否出现刷分
- 用户是否开始为了 XP 做无意义行为

---

# 66. 设计决策优先级

任何 UI / 功能冲突时，优先级：

```text
真实成长
>
理解成本
>
记录效率
>
长期可持续
>
信息清晰
>
游戏感
>
装饰性视觉
```

---

# 67. 产品最终形态

理想状态下，用户打开系统看到的不是：

> “今天还有 7 个 Todo。”

而是：

```text
PLAYER Lv.32

Current State
Energy 72
Focus 81
Momentum 68

Main Quest
硕士毕业
67%

Recent Breakthrough
Independent Statistical Modeling

Knowledge World
1,428 Nodes

Artifacts
126

Next Best Action
完成论文 Discussion 第 2 节
```

用户关闭系统之后，回到现实完成行动。

然后再次回来：

> **结算成长。**

---

# 68. 核心交互原则总结

1. 自然语言优先
2. AI 自动结构化
3. 用户确认高影响判断
4. 记录必须低摩擦
5. 成长必须高反馈
6. Dashboard 不过载
7. Skill Tree 展示能力
8. Knowledge Map 展示认知
9. Artifact 展示现实资产
10. Quest 展示人生推进
11. Review 展示长期变化
12. AI 必须解释所有重要判断

---

# 69. 最终产品一句话定义

> **AI Personal Growth RPG 是一个让用户把现实世界中的学习、工作、技能、运动和人生目标转化为可验证的角色成长，并通过 AI Game Master、技能树、知识地图、任务系统与成长反馈持续推动现实进步的个人成长 Web App。**

---

# 70. 产品体验核心句

用户每次使用结束时，应该至少得到以下三个问题中的答案：

> **我今天做了什么？**

> **我因此具体变强了什么？**

> **我下一步最值得做什么？**

如果一个功能无法帮助回答这三个问题中的任何一个，应谨慎加入系统。
