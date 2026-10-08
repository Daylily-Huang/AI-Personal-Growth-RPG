# 整站就绪度补充：手机小地图与连线键盘验收

状态：ADMISSION CANDIDATE；不是准入 GO、实现验收、合并、部署或整站完成证明。
接受基线：f100d1fe10583d1b228e5ad23b0e9fded2730b25，tree 4cc70cb0d9be497234d546dd291282cb70235ab6（PR52；当前 GitHub main、post-main CI 与保留的 3012 预览已重新核验）。

## 1. 目标与已有证据

前阶段真实手机截图记录了既有 MiniMap 覆盖部分节点；其合成账号没有 edges，故只能证明无连线时不误跳，不能替代有连线图谱的箭头导航验收。本阶段不把这些缺口改写成先前通过，也不重新开放已修好的相机逻辑。

在现有手机交互中不显示遮挡节点的小地图；较宽屏幕保持现有小地图交互。使用现有 `src/app/globals.css` 的 `--breakpoint-md: 48rem`，与 MobileNav/AppShell 的 `md` 分界一致，不新增断点、颜色、层级或固定尺寸。实际断点边界由生产构建后的 CSS 与真实浏览器核验，不把源码类名或 jsdom 当作可见性证明。

## 2. 精确范围与禁止项

生产仅两条路径，而且每个文件只在原 MiniMap 的 className 增加 `hidden md:block`：

1. src/app/skills/components/SkillGraphCanvas.tsx
2. src/app/knowledge/components/KnowledgeGraphCanvas.tsx

测试只允许：tests/graph-mobile-overlay.test.tsx、tests/graph-mobile-governance.test.ts、tests/helpers/governance-delta.ts、tests/visual-foundation.test.ts、tests/phase6-knowledge-ui.test.tsx、tests/graph-canvas-governance.test.ts。
文档只允许：本文件、docs/SiteReadiness/05_GRAPH_MOBILE_VERIFICATION.md、docs/MASTER_PROJECT_HANDOFF.md、task_plan.md、findings.md、progress.md。合计十四个路径；不是目录级权限。

禁止改变相机 hook、两 page、keyboard-navigation、节点/cluster/edge 映射与事实、布局算法、选中/Inspector、共享组件/AppShell/Design Tokens/全局 CSS、API/Auth/RLS/SQL/migrations、Core/奖励/AI、环境配置、package/lock/工具配置/工作流/public/scripts。原 02/03、Phase5/6/7/8F 控制文件与已接受基线不可改写。不借用技能建档、Core bugfix、8F 或 02 的历史许可扩大本阶段。

## 3. 行为承重与所有引用常量

- 手机 MiniMap 的实际面板（不是仅内部 svg）必须 display:none 且不拦截点击/触控/Tab；较宽屏幕 display:block，原 pannable/zoomable、bottom-left、nodeColor/maskColor/原样式全部保留。两个 Canvas 的 ReactFlow、Controls、相机/选择/导航参数逐字保持。
- 现有断点 48rem，现有触控目标 `--touch-target-min` = 44px；测试 320、375、390、767、768、1024、1440 CSS-px（默认浏览器字体下），另检查实际媒体查询。手机缩放/fit 控件、列表/表格入口保持可用；不能用隐藏节点或删掉关系来避免遮挡。
- 相机和缩放既有参数保持：Skills padding .2、min/max .15/1.75、focus offsets 112/56、zoom 1.15；Knowledge .25、.1/2、140/92、zoom 1.1；正常 duration 来自既有 token，reduced-motion 为 0。不重加自动 fitView，不破坏 measured/ResizeObserver/identity/manual-pan/全隐藏往返的 PR52 回归。
- 当前实际 `findNextSkillNode`/`findNextKnowledgeNode` 只在已加载真实连线的邻居中按空间方向选最近者，等距离以 ID 排序；键盘遍历忽略边朝向不改变保存的 relation。浏览器须真实 Arrow/Tab/Enter/Space/Escape，不派发假业务数据或仅用 focus() 替代遍历。
- 原冻结奖励 v1 八数值仍为 [150,100,150,200,200,100,150,250]、IMMUTABLE；XP 与 Mastery 分离、现实成就零积分、Artifact 认定与奖励继续延期。图谱测试不能成为真实 AI、Evidence、Growth 或全新用户十三步的完成证明。

## 4. 治理适配

新增独立 MOBILE_GRAPH 两生产路径、固定十四路径白名单和五 markers（本控制文件、两生产文件、两个新测试），缺任一 marker 不得启用新许可。新的完整 working+untracked delta 相对 f100 严格检查全部路径；新的完整 PR/current-main-first-parent 范围也严格检查，Git 失败不吞掉、无 HEAD~1 捷径。
visual 验证器仅增加排在旧分支前的新精确分支；Phase6 实际 committed-delta 入口仅增加 mobile 选择器，未绑定时使用原 graphCanvasKnowledgePolicy，所有旧 policy/旧 synthetic assertions 原样。
原 graph-canvas-governance 从 ab84 累计检查的实际 working 入口可排除仅本阶段新增的两个文档和两个测试路径，但必须先具备全部新 markers，并同时严格检查完整 f100 新 delta；不排除任何 production、旧测试或配置路径，不改变原 graphCanvasScopeViolations 和全部历史合成断言。8F 累计守卫无新增豁免：旧相机范围已经覆盖这两条 Canvas，本阶段新增 f100 完整守卫另行阻断任何相机/Core 等变化。
独立攻击每个缺 marker、混入旧 Core/SQL/权限/AI/导航/共享 UI/hook/page/配置/依赖/工作流/任意 docs/tests 等路径，以及旧准入 markers 混入后的越权；必须保留原断言，不能为了绿色删除或放宽旧规则。

## 5. 验收与资源所有权

先 fresh Risk2 ADMISSION GO，之后才修改生产或旧治理守卫。候选主门禁包括 lint/TS/生产 build、原相机/identity/motion、Skills/Knowledge/keyboard、全部真实 PostgreSQL/HTTP regression、deterministic harness 与真实 Chrome 可见性/断点/resize/cold/zoom/键盘/表格。
仅使用新的可销毁合成项目（独立 project/workdir、API54331/DB54332）创建至少三节点和保存的合法 Skills/Knowledge edges；记录连线 ID/端点/type/authority，测试前后对比图谱事实与 XP/账本/奖励状态不变。原用户开发库 API54321/DB54322、恢复副本、备份和预览3010/3011/3012一律不写、不重启、不删除。独立审查前 exclusive DB grant，直接 DB_ACCESS_COMPLETE 后才精确销毁本任务资源；不能全局 prune。
新完整候选代码/测试/文档/原始日志与 browser/build 绑定完成后，fresh Risk2 precommit 零 finding GO 才 commit/draft PR；自身 exact-head CI 与不同 fresh committed FINAL 零 finding GO 后按用户已委托 ordinary merge，再核验主 CI。改动受审字节使旧 binding 失效。
真实 AI 用户稍后提供项目接口，本阶段不请求 AI、不借 DSH 密钥、不把 mock 当真实 AI；新用户引导与 04§13 全十三步、公开部署仍未完成。本阶段验收不能用于标记整站目标 complete。
