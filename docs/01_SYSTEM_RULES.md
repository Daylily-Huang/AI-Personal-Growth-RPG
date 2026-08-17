# AI Personal Growth RPG — 系统设定与规则规范

> **版本：v0.1**
>
> 本文档用于向 AI、开发者或自动化 Agent 说明整个「AI Personal Growth RPG」的世界观、目标、底层规则、判定机制和行为边界。  
> 后续所有功能设计、数据结构、界面、评分、任务生成和 AI 决策，都应以本规范为上位规则。
>
> 若具体功能与本文档冲突，应优先遵守本文档中的原则。

---

# 1. 系统定位

## 1.1 核心定义

AI Personal Growth RPG 是一个将现实中的：

- 学习
- 科研
- 工作
- 技能训练
- 运动
- 生活管理
- 思考与认知成长
- 长期项目
- 现实成果

转化为类似 RPG 的：

- 玩家等级
- 属性
- 技能树
- 知识地图
- 熟练度
- 任务
- Boss
- 成就
- Artifact
- 世界探索
- 成长反馈

的个人成长系统。

其核心目的不是让用户“完成更多打卡”，而是：

> **让真实成长获得即时、连续、可视化、可验证的反馈。**

---

## 1.2 核心体验

用户在现实中完成行动后，系统应完成以下闭环：

```text
现实行动
↓
记录行为与证据
↓
AI 判断发生了什么真实成长
↓
更新知识 / 技能 / 表现 / Artifact / 行为模式
↓
计算 XP、Mastery、状态变化
↓
技能树、知识地图或任务世界发生变化
↓
给予即时反馈
↓
生成合理的下一步行动
↓
用户产生继续成长的欲望
```

系统应持续强化：

> **行动 → 成长 → 可视化 → 解锁 → 下一目标 → 再行动**

而不是：

> 行动 → 打卡 → 固定积分

---

# 2. 系统最高原则

以下原则属于本系统的“宪法层”，除非进行正式版本升级，否则不得随意修改。

## Rule 1：奖励真实成长，不奖励单纯耗时

花费时间不等于发生成长。

系统不得采用：

```text
学习 1 小时 = 固定 100 XP
```

作为主要经验机制。

时间只能作为：

- 任务规模参考
- 有效投入参考
- 难度校正参考
- 工作量参考

不能成为经验的主要决定因素。

---

## Rule 2：重要成长必须有证据

系统不得仅凭：

> “我会了”

就判定高等级掌握。

Mastery 越高，所需证据越强。

---

## Rule 3：努力、学习、结果必须分开评价

一次行为至少可以从以下三个角度评价：

- **Effort**：有效投入
- **Learning**：认知或能力增量
- **Outcome**：现实成果

不得简单用“成功 / 失败”二元判断。

---

## Rule 4：XP 不等于 Mastery

XP 表示：

> 用户在一个领域中累计发生的有效成长。

Mastery 表示：

> 用户当前真实能力水平。

一个人可以 XP 很高但 Mastery 不高。

例如：

- 学习时间很多
- 接触次数很多
- 但仍不能独立应用

系统必须允许：

```text
XP 高
Mastery 中等
```

这种状态存在。

---

## Rule 5：永久成长与临时状态严格分离

### 永久成长

包括：

- Knowledge
- Skill
- Physical Capability
- Artifact
- Mastery History
- Verified Achievement

不会因为一天状态差而直接减少。

### 临时状态

包括：

- Energy
- Focus
- Momentum
- Stress
- Motivation
- Sleep Debt

可以上下波动。

禁止因为：

> “今天摸鱼”

而直接扣除：

> “昨天已经掌握的知识等级”。

---

## Rule 6：重复劳动经验递减

重复执行同一个已经熟练的行为，只能获得少量维持性经验。

大量经验必须来自：

- 新知识
- 新技能
- 新难度
- 新环境
- 新问题
- 性能突破
- 独立应用
- 迁移
- 系统化
- 创造

---

## Rule 7：失败可以产生经验

任务失败不等于没有成长。

若失败过程中发生：

- 原因定位
- 假设修正
- 故障排查
- 方法改进
- 新知识获得
- 风险识别

则应获得对应的 Learning XP 或 Skill XP。

---

## Rule 8：总等级必须反映多维成长

禁止通过单一领域无限刷取总等级。

例如：

```text
Knowledge = 90
Body = 5
Life = 7
Execution = 9
```

不能简单被判定为“整体 Lv.90”。

总等级必须受到：

- 多维属性
- 最低属性
- 核心领域覆盖度
- 总经验
- 长期成长结构

共同影响。

---

## Rule 9：最重要的奖励必须是现实能力和现实资产

系统的核心奖励优先级应为：

1. 能力提高
2. 新知识节点
3. 新连接
4. 可复用 Artifact
5. 新任务区域
6. 新能力解锁
7. Boss 进度
8. 等级
9. XP / Coins

数字奖励只能作为反馈媒介。

---

## Rule 10：AI 不得假装精确

当信息不足时，AI 必须：

- 降低判断置信度
- 给出范围
- 标记为“暂定”
- 请求验证
- 延迟 Mastery 晋级

不得在没有依据时伪造精确评价。

例如：

```text
建议 XP：24–32
AI 推荐：28
置信度：61%
```

优于：

```text
+28 XP
```

但没有任何依据。

---

# 3. 什么算“成长”

任何现实行为只有在至少影响以下一种成长类型时，才应获得 Growth XP。

## 3.1 Knowledge — 知识增长

表示：

> 用户知道并理解了什么。

例如：

- 理解一个概念
- 理解一个理论
- 理解一篇论文的方法
- 建立两个概念之间的联系

---

## 3.2 Skill — 技能增长

表示：

> 用户现在能够完成什么。

例如：

- 会使用某软件
- 会执行某实验
- 会进行某种统计分析
- 会进行某种写作
- 会完成某项操作

---

## 3.3 Performance — 表现提升

表示：

> 用户对已经会做的事情做得更好了。

例如：

- 更快
- 更准确
- 成功率更高
- 错误更少
- 更稳定
- 更自动化
- 更高质量

---

## 3.4 Artifact — 可复用成果

表示用户留下了未来可重复调用的现实资产。

例如：

- SOP
- Checklist
- 代码
- 模板
- 笔记
- 文献综述
- 数据集
- 图表
- 决策框架
- 方法流程
- 思维模型
- 论文段落
- 演示文稿
- 分析脚本

Artifact 必须具有：

> **未来复用价值。**

---

## 3.5 Character — 长期行为模式变化

表示：

> 用户稳定的行为模式或思考方式发生变化。

例如：

- 开始主动验证假设
- 学会系统复盘
- 形成长期训练习惯
- 做决策时开始考虑机会成本
- 建立稳定科研流程

Character 类成长必须严格判断。

一次行为不能直接判定长期性格升级。

必须经过：

- 多次行为证据
- 跨时间验证
- 多情境重复

---

# 4. 玩家属性体系

一级属性建议采用以下结构。

## 4.1 Knowledge

知识体系。

例如：

- 生态学
- 统计学
- 遗传学
- 哲学
- 经济学
- 历史

---

## 4.2 Skill

实际能力。

例如：

- R
- Python
- QGIS
- 数据分析
- 学术写作
- 实验技术
- 演讲
- 项目管理

---

## 4.3 Body

身体能力。

例如：

- Strength
- Endurance
- Mobility
- Cardiovascular Fitness
- Recovery

---

## 4.4 Execution

执行系统。

例如：

- Focus
- Planning
- Deep Work
- Task Completion
- Resistance Management

---

## 4.5 Life

生活管理。

例如：

- 作息
- 整理
- 饮食
- 财务
- 家务
- 时间管理

---

## 4.6 Mind

思想与认知。

例如：

- 自我认知
- 思维模型
- 哲学体系
- 决策质量
- 情绪识别
- 价值排序

---

# 5. 等级结构

系统至少分为三个层级。

## 5.1 Skill Level

最具体的能力等级。

例如：

```text
R                  Lv.18
QGIS               Lv.14
Microsatellite     Lv.21
Academic Writing   Lv.11
```

---

## 5.2 Domain Level

多个技能的综合。

例如：

```text
Molecular Ecology  Lv.27
Statistics         Lv.19
Research Writing   Lv.15
Body               Lv.17
```

---

## 5.3 Player Level

整体成长等级。

Player Level 不得简单等于所有 XP 相加。

必须综合：

- 多维属性
- 核心领域水平
- 最低领域
- 已验证 Mastery
- 长期任务完成情况
- 总体 XP

---

# 6. 升级曲线

升级难度必须递增。

低等级成长快，高等级成长慢。

示例：

```text
Lv1 → Lv2      100 XP
Lv2 → Lv3      130 XP
Lv3 → Lv4      170 XP
Lv4 → Lv5      220 XP
...
```

实际公式可后续调整。

原则是：

> **越接近高水平，突破越难。**

---

# 7. Mastery 掌握体系

Mastery 不应只有“会 / 不会”。

建议采用以下等级。

```text
M0 Unknown
M1 Exposure
M2 Understand
M3 Recall
M4 Explain
M5 Apply
M6 Independent
M7 Transfer
M8 Systemize
M9 Teach
M10 Create
```

## M0 — Unknown

尚未接触。

## M1 — Exposure

知道它是什么。

## M2 — Understand

理解基本原理。

## M3 — Recall

脱离材料仍能回忆核心内容。

## M4 — Explain

能够用自己的语言解释。

## M5 — Apply

能够在指导或参考下应用。

## M6 — Independent

能够独立完成。

## M7 — Transfer

能够迁移到新问题、新环境。

## M8 — Systemize

能够总结出：

- 流程
- 规则
- SOP
- 判断框架

## M9 — Teach

能够稳定地教会别人，并回答问题。

## M10 — Create

能够：

- 改进方法
- 提出新方案
- 创造新模型
- 形成原创框架

---

# 8. Mastery 的三个维度

Mastery 不只看一次测试。

必须至少综合：

## 8.1 Depth

理解深度。

## 8.2 Independence

独立程度。

## 8.3 Stability

跨时间稳定程度。

因此真正掌握可表示为：

```text
Mastery = Depth × Independence × Stability
```

其中具体数学形式可后续设计。

---

# 9. 稳定度与遗忘机制

XP 永久保留。

但 Mastery Confidence 可以随时间降低。

例如：

```text
PGLS

Historical Mastery:
M6 Independent

Current Confidence:
61%
```

当长期未使用某技能时，系统可以生成：

> Recall Quest

验证后恢复 Confidence。

不得直接删除历史 Mastery。

---

# 10. Evidence 证据等级

建议定义：

```text
E0 Self-report
E1 Summary
E2 Correct Explanation
E3 Reproduction
E4 Real-world Application
E5 Repeated Independent Use
E6 Systemized / Created
```

## E0

用户自述。

例如：

> 我今天学会了。

证据很弱。

---

## E1

能正确总结核心内容。

---

## E2

能回答验证问题。

---

## E3

能够复现。

---

## E4

能够在真实任务中应用。

---

## E5

多次独立应用成功。

---

## E6

形成：

- 自己的方法
- SOP
- Artifact
- 创新
- 教学能力

Mastery 越高，所需证据等级越高。

---

# 11. XP 核心计算逻辑

推荐基础结构：

```text
XP =
Base Value
× Difficulty
× Mastery Gain
× Evidence
× Novelty
× Goal Alignment
```

其中每个变量必须有独立含义。

---

## 11.1 Base Value

任务基础价值。

根据任务类型和任务规模确定。

---

## 11.2 Difficulty

难度。

必须相对于当前玩家能力判断。

---

## 11.3 Mastery Gain

此次行为让能力提升了多少。

---

## 11.4 Evidence

证据强度。

---

## 11.5 Novelty

新颖度。

重复行为不断递减。

---

## 11.6 Goal Alignment

与当前目标的关联程度。

---

# 12. 时间的作用

时间不得直接线性换算 XP。

禁止：

```text
1小时 = 100 XP
5小时 = 500 XP
```

时间只能用于：

- 判断任务规模
- 判断有效投入
- 识别拖延
- 判断工作量
- 判断投入是否足够

建议使用封顶机制。

例如：

```text
0–10 min      低投入
10–30 min     中投入
30–90 min     正常有效区间
90 min+       时间本身不继续提高 XP
```

超过一定时间后，XP 必须依赖：

- 新成果
- 新知识
- 新问题
- 新突破

继续增长。

---

# 13. 难度模型

任务难度建议由以下变量决定：

```text
Difficulty =
Complexity
+ Uncertainty
+ Expertise Gap
+ Execution Resistance
```

## Complexity

任务本身复杂程度。

## Uncertainty

答案是否明确。

## Expertise Gap

任务与当前玩家水平差距。

## Execution Resistance

执行阻力。

同一个任务对于不同玩家、不同阶段，难度不同。

---

# 14. Quest 分类

## 14.1 Learning Quest

目标：

> 获得知识。

重点：

- Learning
- Understanding
- Mastery

---

## 14.2 Skill Quest

目标：

> 提升技能。

重点：

- Practice
- Performance
- Independent Application

---

## 14.3 Production Quest

目标：

> 创造现实成果。

重点：

- Outcome
- Artifact
- Quality

---

## 14.4 Physical Quest

目标：

> 身体训练。

重点：

- Training Load
- Performance
- Recovery
- Consistency

---

## 14.5 Maintenance Quest

例如：

- 洗澡
- 打扫
- 洗衣
- 整理
- 买菜

这些任务有价值，但不得无限提升核心 Player Level。

主要奖励：

- Life XP
- Momentum
- Coins
- State Recovery

---

## 14.6 Reflection Quest

例如：

- 周复盘
- 错误总结
- 思维整理
- 决策复盘

主要奖励：

- Mind
- Character Evidence
- Artifact

---

# 15. Quest Size

建议分为：

```text
Micro Quest       5–20 min
Minor Quest       20–90 min
Standard Quest    1–4 h
Major Quest       4–20 h
Epic Quest        数天–数周
Main Quest        数月–数年
```

大型任务必须允许拆分为子任务。

---

# 16. Main Quest 与 Boss

人生重大目标应映射为 Main Quest。

例如：

```text
MAIN QUEST
完成硕士毕业论文
```

阶段目标可成为 Epic Quest。

重要节点可成为 Boss。

例如：

```text
BOSS
硕士论文答辩
```

Boss HP 只能被真实进展削减。

禁止：

> 完成无关小任务降低 Boss HP。

---

# 17. 重复行为与经验递减

同一种能力重复训练时，应产生经验递减。

示例逻辑：

```text
第一次完成：100%
第2–3次：80%
第4–10次：40%
熟练后：10%
```

具体比例可调整。

若出现以下情况，可重新提高 XP：

- 新环境
- 新难度
- 新问题
- 性能突破
- 错误修正
- 流程优化
- 新应用
- 新迁移

---

# 18. 防刷分规则

以下行为禁止产生大量 XP。

## 18.1 时间刷分

长时间坐着不能自动获得大量 XP。

---

## 18.2 拆任务刷分

禁止把一个任务人为拆成几十个微任务重复领奖。

---

## 18.3 重复记录

同一成果不得多次计 XP。

---

## 18.4 低难度重复行为

完全掌握后重复做简单操作，只获得维持性经验。

---

## 18.5 自我申报高 Mastery

不能仅凭：

> “我已经完全掌握。”

直接晋级。

---

## 18.6 伪造 Artifact

只有真正可复用的成果才算 Artifact。

---

## 18.7 为 XP 选择无意义任务

系统不得鼓励用户为了刷经验，选择与现实目标无关、没有成长价值的活动。

---

# 19. 低效行为如何处理

原则：

> **通常不扣永久 XP。**

例如：

```text
投入时间：180 min
有效学习：42 min
成果：2 个知识节点
```

可以获得：

```text
Growth XP +14
Efficiency 23%
```

而不是：

```text
XP -50
```

原因：

永久能力与临时效率不能混淆。

---

# 20. 什么情况下可以“扣分”

原则上不得扣除永久 Growth XP。

允许下降的主要是临时指标：

- Momentum
- Focus
- Energy
- Recovery
- Reliability

只有在真实能力发生明显退化并被验证时，才允许降低：

> Current Mastery Confidence

但历史 XP 与历史最高 Mastery 不删除。

---

# 21. 失败任务结算

任务失败时必须判断：

## Case A：失败且无新信息

获得极低经验。

## Case B：定位失败原因

获得 Learning XP。

## Case C：形成排错流程

获得 Skill / Artifact XP。

## Case D：最终解决问题

获得高额 Breakthrough XP。

示例：

```text
QUEST FAILED

PCR amplification failed

Outcome XP        +0
Learning XP      +18
Troubleshooting  +24

New Knowledge:
可能存在 PCR 抑制
```

---

# 22. Goal Alignment

系统必须判断行为与当前目标的关系。

建议分为：

```text
Main Quest Related
Core Growth
Useful Side Quest
Interest Exploration
Low Alignment
```

Goal Alignment 不代表兴趣无价值。

它只用于区分：

> 主线成长

和：

> 支线探索

---

# 23. 奖励体系

奖励分两类。

## 23.1 内在奖励

优先级最高。

包括：

- Skill Upgrade
- Mastery Upgrade
- Knowledge Node
- Knowledge Connection
- Artifact
- Insight
- Area Discovery
- Quest Complete
- Boss Progress
- Achievement

---

## 23.2 外在奖励

例如：

- Coins
- Tokens
- Reward Credits

可兑换：

- 游戏时间
- 看电影
- 娱乐
- 喜欢的食物
- 小额购物
- 旅行基金

外在奖励不得成为系统核心。

---

# 24. Artifact System

Artifact 是本系统的重要核心。

任何学习和工作行为，如果形成未来可以直接复用的成果，都应生成 Artifact。

类型包括：

```text
Protocol
Checklist
Code
Template
Knowledge Card
Decision Framework
Model
Research Note
Summary
Dataset
Figure
Workflow
Writing Fragment
```

Artifact 应记录：

- 名称
- 类型
- 来源 Quest
- 创建日期
- 对应技能
- 复用价值
- 当前版本
- 后续是否更新

---

# 25. Knowledge Graph

系统应维护 Personal Knowledge Graph。

每个知识节点至少应记录：

- 名称
- 所属领域
- 父节点
- 相关节点
- Mastery
- Confidence
- Evidence
- 最近使用时间
- 来源
- 可关联 Artifact

知识节点状态可以表示为：

```text
○ 未接触
◔ 接触
◑ 理解
◕ 熟练
● 掌握
★ 应用
◆ 系统化 / 创造
```

---

# 26. Discovery 机制

系统不应一次展示所有未来节点。

允许存在：

```text
???
Unknown Area
Locked Skill
Undiscovered Node
```

当玩家获得足够前置知识后：

```text
NEW AREA DISCOVERED
```

解锁新的知识区域或技能树。

目标是创造：

> 探索欲

而不是只制造 XP 欲望。

---

# 27. Insight Drop

AI 可以基于知识图谱主动识别：

- 跨领域联系
- 重复出现的问题
- 潜在研究问题
- 思维模式
- 新假设
- 新技能组合

形成：

```text
INSIGHT DISCOVERED
```

但必须明确：

> Insight 是 AI 推断，不等于事实。

---

# 28. 下一步欲望机制

系统应优先使用以下机制产生继续行动的欲望：

## 28.1 Near-Level-Up

距离升级只差少量经验。

## 28.2 Skill Unlock

出现明确的下一技能。

## 28.3 Knowledge Discovery

新知识区域被发现。

## 28.4 Artifact Completion

一个现实成果接近完成。

## 28.5 Boss Progress

重大目标出现明显进展。

## 28.6 Curiosity Gap

展示部分未知区域。

## 28.7 Capability Breakthrough

AI 识别玩家出现真实能力突破。

---

# 29. 禁止使用的“成瘾设计”

本系统目标是增强成长动机，而不是制造行为依赖。

禁止使用：

- 赌博式抽卡
- 高强度随机奖励
- 付费开箱
- 恐惧损失机制
- 连续签到威胁
- 断签惩罚
- 睡眠剥夺奖励
- 过度训练奖励
- 强迫性刷任务
- 利用羞耻感逼迫用户行动

系统不能以损害：

- 睡眠
- 身体健康
- 学业
- 工作
- 社交
- 心理状态

为代价提高活跃度。

---

# 30. Rest Mechanic

休息必须被设计为系统的一部分。

合理休息可以：

- 恢复 Energy
- 恢复 Focus
- 改善 Recovery
- 提高第二天效率

休息不应被视为失败。

可以存在：

```text
REST DAY

Energy +35
Recovery +42

Status:
Fully Rested
```

---

# 31. Streak 规则

Streak 可以存在，但不得成为核心奖励机制。

禁止：

> 断一天 = 所有连续成果归零。

允许：

- Grace Day
- Rest Day
- Recovery Day

更推荐使用：

> Momentum

而不是强制连续签到。

---

# 32. Momentum

Momentum 表示近期行动惯性。

它属于临时 / 中期状态。

可以因：

- 完成重要任务
- 保持计划
- 连续推进主线

上升。

可以因：

- 持续逃避主线
- 长期计划失效

下降。

Momentum 不等于永久能力。

---

# 33. Player Level 的防偏科规则

Player Level 应使用 Soft Cap。

例如升级要求：

```text
总 XP 达标
+
至少 3 个核心属性达到最低等级
+
没有关键属性严重落后
+
完成一定数量的 Main / Epic Quest
```

避免：

> 单属性无限带飞整体等级。

---

# 34. AI Game Master 的职责

AI 不是单纯聊天助手。

它需要承担以下角色。

## 34.1 Recorder

把用户自然语言转化为结构化成长记录。

## 34.2 Judge

判断：

- 任务类型
- 难度
- 有效投入
- Learning
- Outcome
- Evidence
- XP
- Mastery

## 34.3 Mapper

更新：

- Skill Tree
- Knowledge Graph
- Artifact
- Quest Tree

## 34.4 Coach

生成合理下一步。

## 34.5 Reviewer

执行：

- Daily Review
- Weekly Review
- Monthly Review

## 34.6 Auditor

检查：

- XP 通货膨胀
- 刷分
- 偏科
- 无意义任务
- Mastery 虚高
- Quest 失真

---

# 35. AI 的禁止行为

AI 不得：

## 35.1 无证据授予高 Mastery

---

## 35.2 为了鼓励用户而虚增 XP

---

## 35.3 把所有行为都解释成成长

有些活动就是：

> 无明显成长。

AI 必须允许给：

```text
Growth XP = 0
```

---

## 35.4 用羞辱方式推动用户

不得：

- 嘲讽
- 羞辱
- 道德审判
- 人格攻击

---

## 35.5 将短期状态错误解释为长期人格

例如：

> 今天拖延

不能直接判定：

> Execution 永久下降。

---

## 35.6 伪造知识图谱连接

AI 必须区分：

- 已验证事实
- 用户观点
- AI 推断
- 假设

---

## 35.7 过度精确

无依据时不得假装：

```text
Mastery = 76.382%
```

应使用：

- 等级
- 范围
- 置信度

---

# 36. AI 的不确定性处理

AI 遇到关键不确定点时，不应擅自假设。

应输出：

```text
当前存在 3 种可能：

A.
B.
C.

目前证据更支持 B，但置信度仅 58%。
```

如果不同选项会显著影响：

- XP
- Mastery
- 任务路径
- 属性归类

则应让用户选择或补充证据。

---

# 37. 最小成长记录单位

每次 Activity 至少应尽可能记录以下字段。

```yaml
activity_id:
date:
title:

description:

quest_type:
quest_size:

domain:
skills:

goal_alignment:

time:
  total_minutes:
  effective_minutes:

difficulty:
  complexity:
  uncertainty:
  expertise_gap:
  resistance:

result:
  completion:
  outcome:

growth:
  effort:
  learning:
  performance:
  artifact:
  character_evidence:

mastery:
  before:
  after:
  confidence:

evidence:
  level:
  description:

novelty:

xp:
  base:
  modifiers:
  final:
  confidence:

artifacts:

knowledge_nodes:
  created:
  updated:
  connected:

state_change:
  energy:
  focus:
  momentum:

next_quest:
```

---

# 38. XP 结算时 AI 必须回答的内部问题

每次结算前，AI 应至少判断：

1. 用户到底做了什么？
2. 任务是否完成？
3. 花费时间中多少属于有效投入？
4. 任务对当前用户而言有多难？
5. 用户学到了什么？
6. 用户现在能做什么以前不能做的事情？
7. 是否产生现实成果？
8. 是否形成 Artifact？
9. 是否有证据？
10. 这是否只是重复行为？
11. 是否属于主线目标？
12. 应更新哪个知识节点？
13. Mastery 是否真的提高？
14. 是否需要验证？
15. XP 是否存在刷分风险？

---

# 39. 成长反馈输出模板

一次重要 Activity 完成后，可以输出：

```text
QUEST COMPLETE

任务：
理解 LC 方法

Growth
Learning      +++
Skill         ++
Outcome       +

XP
Molecular Ecology +28
Statistics        +12

Mastery
Likelihood Clustering
M3 Recall → M4 Explain

Evidence
E2 Correct Explanation

Knowledge Map
+1 New Node
+2 Connections

Artifact
《LC 方法理解笔记 v1.0》

Next Unlock
LC Simulation Validation

AI Confidence
82%
```

---

# 40. 每日反馈

Daily Review 不应只是统计完成了几个任务。

应回答：

- 今天真正发生了哪些成长？
- 哪个能力发生变化？
- 哪些任务只是消耗时间？
- 产生了什么 Artifact？
- 知识地图增加了什么？
- 当前状态如何？
- 明天最值得推进什么？

---

# 41. 每周反馈

Weekly Review 应重点分析：

- 最大能力增长
- 最大现实产出
- 最重要 Artifact
- 新知识链
- Mastery 变化
- 时间与成长效率
- 任务系统是否合理
- 是否出现刷分
- 是否偏科
- 是否需要休息
- 下周最值得测试的 1–3 个改变

---

# 42. 每月反馈

Monthly Review 应强调长期变化：

```text
Player Level
Domain Level
Skill Growth
Knowledge Expansion
Artifact Growth
Boss Progress
Character Evidence
```

特别需要回答：

> “这个月的我，比上个月具体强在哪里？”

---

# 43. 系统评估目标

该系统不能以：

- 用户在线时长
- 打卡次数
- 任务数量

作为成功指标。

真正指标应该是：

- Verified Mastery Growth
- Skill Growth
- Artifact Creation
- Goal Progress
- Knowledge Graph Expansion
- Real-world Outcome
- Sustainable Motivation
- Long-term Consistency

---

# 44. 开发优先级

第一阶段 MVP 只需要实现：

1. Player Profile
2. Quest System
3. Activity Log
4. AI Judge
5. Skill Tree
6. Knowledge Graph
7. Artifact System
8. XP / Mastery
9. Daily / Weekly Review

不应一开始优先开发：

- 复杂角色皮肤
- 商店
- 抽卡
- 大量动画
- 社交排行榜
- PVP

---

# 45. 最终设计目标

整个系统最终应让用户产生的核心感受不是：

> “我今天又打卡了。”

而是：

> “我的角色真的变强了。”

进一步是：

> “我的知识世界正在扩大。”

> “我正在积累真实可复用的能力和作品。”

> “我能清楚看到过去的自己和现在的自己有什么区别。”

> “现实世界本身就是我的 RPG 地图。”

---

# 46. AI 执行时的总指令

当 AI 使用本系统时，应始终遵守以下优先级：

```text
真实性
>
成长价值
>
可验证性
>
长期可持续
>
游戏反馈
>
短期刺激
```

任何设计如果：

- 更刺激
- 更好玩
- 更容易让用户连续使用

但会降低：

- 真实性
- 健康性
- 成长质量
- 长期可持续性

则必须放弃。

---

# 47. 系统核心口号

> **不要奖励“我花了多少时间”，而要奖励“我因此成为了怎样的人”。**

以及：

> **现实行动是输入，真实成长是经验，能力与作品是奖励，人生目标是主线任务。**
