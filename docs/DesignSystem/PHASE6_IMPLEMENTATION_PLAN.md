# Phase 6 — 知识图谱画布实施与验收

基线：main `a93e2bcada3eca63c3d69ecc633fd50df0f54e94`。分支：`feature/phase6-knowledge-canvas`。状态：实施中，未冻结。

## 范围与设计决定

- 页面：`/knowledge` 及其局部组件。沿用 ReactFlow 和冻结的知识 API；数据库、结算、权限、成长规则与共享基元均零修改。
- 使用前端确定性领域／节点类型分组布局，保留可切换的 API 原始关系布局。分组仅改变视图坐标，不创建知识实体或关系，不新增依赖。
- 知识卡片显示权威状态与知识置信度；关联技能区域单独使用 MasteryBadge、ConfidenceBadge 和 XPProgress，避免将知识权威状态等同个人掌握度。
- 节点与关系共用一个 InspectorDrawer；移动筛选、元数据编辑及验证确认复用 BaseModal。来源产物与证据继续使用真实 API 字段。
- 独立关系权威与关系类型过滤只筛选当前已加载边，不改变后端节点筛选语义。提供列表入口供窄屏与键盘访问。

## Round 2 治理闭环

- Knowledge Node 本体只拥有认识论权威状态与知识置信度；Inspector 内的 Linked Skill Summary 是明确标注的、只读的 Skill 子区块，只读取真实 `skillId` 对应的 Skill read model，不把 Knowledge authority/confidence 转换为 Skill mastery/confidence，也不在加载或失败时伪造 M0、XP 或置信度。
- `KnowledgeNodeView` 复用冻结的交互式 `RPGCard`，语义为 `role="button"`、`tabIndex=0`，由冻结基元提供 Enter/Space 激活；不得描述为原生 `<button>`。
- `/knowledge` 下的页面局部交互控件使用冻结 `var(--touch-target-min)`，ReactFlow `Controls` 仅由 `KnowledgeGraphCanvas` 的局部选择器治理；不修改共享基元或设计 token。
- Round 2 仅关闭 P1-01、P1-02、P2-01、P2-02、P2-03，并以专项测试、全量质量门禁和冻结路径审计作为完成条件。

## 实施步骤

1. 核对规范与数据契约，固定修改边界。
2. 迁移节点、关系、控件为浅色 Design Tokens；实现分组和视口切换。
3. 集成抽屉、共享弹窗、关联技能状态与来源链接。
4. 补充行为测试和冻结路径守卫，执行完整质量门禁。
5. 记录实际结果与未覆盖项，提交独立审查。

## 测试用例

| 场景 | 预期 |
| --- | --- |
| 分组输入乱序、无领域、重复领域名、多个类型 | 按领域 ID 隔离，位置稳定且不重叠，不修改 API 对象 |
| 前置／包含／支持与对称边 | 有向关系显示方向；矛盾和相关关系无方向箭头 |
| inferred／verified／rejected／superseded／archived | 文字与线型保留权威语义，所有边静态显示 |
| 关系权威和类型筛选 | 仅保留匹配关系，端点存在，已隐藏的选中边不残留详情 |
| 节点 → 关系 → 另一节点 | 始终一个抽屉，正确详情，异步旧结果不能覆盖新选择 |
| 元数据编辑、确认／取消、Escape | 使用共享模态，取消不写 API，Escape 不穿透关闭父抽屉 |
| 关联技能成功／缺失／失败 | 成功才显示真实掌握度和 XP；无关联或失败不虚构 M0 |
| 空图、筛选无结果、加载失败、重试 | 有准确状态与可恢复操作 |
| 键盘、列表、缩放、减少动效 | 节点和边均可经列表选择，视口遵循减少动效偏好 |
| 冻结边界 | 相对基线及未提交差异均不得修改后端、共享基元和依赖 |

质量门禁：知识专项、全量 `pnpm test`、`pnpm harness:deterministic`、`pnpm lint`、`pnpm tsc --noEmit`、`pnpm build`。数据库测试是否执行需据实际环境记录。
