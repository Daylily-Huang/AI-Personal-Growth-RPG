# 整站就绪度补充：图谱测量与尺寸适配

状态：ADMISSION CANDIDATE，非准入GO、候选GO、提交/合并/发布授权。
基线：ab84df35319d08247388051c451be523afe3c7a7（PR51已接受）；这是用户持续完成网站指令范围内的界面缺陷修复，不修改L0规则或新增业务入口。

## 1. 已取得的复现与边界

隔离合成账号8技能/8知识、零总XP，在未修改基线上两图desktop→mobile resize均0/8完整可见，变换未变化；手机冷加载各8/8，仅证明尺寸变化缺陷，不声称冷加载失败。生产候选未提交。
第一纠正版组件测试通过但真实浏览器仍失败：安装的@xyflow/react12.11.3在此controlled只读图谱中nodesInitialized可保持false。第二版Skills真实适配有效，Knowledge inline节点映射重建导致实测尺寸清空，已提出缓存同一映射的修正。
Skills section的工具栏占61px而ReactFlow又占section100%高度，底部被祖先overflow-hidden裁剪；本地观测61px不是新的设计常量，修复须分配实际剩余高度，不硬编码61。内部canvas几何8/8不等于所有节点/控件真实可见。
首完整v2套件101文件/1971通过/2失败，包含预加载旧模块的新增identity断言失败及原8F范围守卫正确拒绝新路径；原JSON E92194AB71FE90A13D13A788EDCE739332366F8E4ECCE9C191376F18E65DA9FA保留。不用于新字节终局证明。

## 2. 精确准入范围

生产路径仅四项：

1. src/components/graph/useGraphCameraFit.ts（新共享camera hook）；
2. src/app/skills/components/SkillGraphCanvas.tsx；
3. src/app/knowledge/components/KnowledgeGraphCanvas.tsx；
4. src/app/skills/page.tsx（只将现有view分配到工具栏后的剩余高度）。

禁止改动其它生产路径、API/认证/租户/RLS/SQL/迁移、成长/奖励/AI/证据业务规则、节点布局算法、edge事实、全局导航/共享primitive/design tokens、package/lock/Next/TS/Vitest配置、工作流/public assets/scripts。不是目录级通行证，也不继承既往Core修复或技能建档的后台许可。
文档限本契约、MASTER、独立验收记录03_GRAPH_CANVAS_READINESS_VERIFICATION.md及三计划文件；测试限graph-camera-fit.test.tsx、新graph-canvas-governance.test.ts、原motion/phase5-skills/phase6-knowledge/visual-foundation/phase8f-ui-governance及helpers/governance-delta.ts。

## 3. 行为承重

- 实際可见节点的内部measured宽高必须有限且严格大于0，所有节点实测后、viewport真正初始化后才能自动fit；不得以固定延时或猜测ready绕过此条件。订阅仅测量尺寸，不写业务/节点事实。Knowledge原cluster与semantic node映射必须保持等价、相同依赖下保持对象身份，避免自身rerender清空测量。
- 真实容器ResizeObserver监听；正尺寸后下一animation frame合并适配，卸载/过期回调取消。尺寸不变、selection/data/callback身份变化不能反转手动pan/zoom；新节点/布局/过滤及实际尺寸变化应适配。空图/全隐藏/零尺寸不fit，再出现时能恢复。
- 保留原Skills padding0.2/minZoom0.15/maxZoom1.75和Knowledge padding0.25/minZoom0.1/maxZoom2；保留原focus offsets(112,56)/(140,92)、zoom1.15/1.1和当前CSS --duration-normal。prefers-reduced-motion适配/定位duration0。上述是既有界面参数，不是Growth/奖励常量。
- 原节点/cluster位置与事实、edge四通道/marker、selection与键盘/Inspector行为不变；只有相机/实际剩余容器高度改变。手机验收计算canvas与overflow祖先/viewport的交集，检查固定导航、全部控制按钮不被裁剪，允许现有表格/列表替代大图。
- 8奖励数值[150,100,150,200,200,100,150,250]及immutable奖励v1、Reality0积分、Artifact认定+奖励延期不变；源数据库和3011用户预览/私密备份不动。合成图谱不能冒称真实成长/AI或整站13步完成。

## 4. 治理守卫最小适配

保留所有旧policy、旧violations/visual历史分支及全部旧合成拒绝断言。新增GRAPH_CANVAS_PRODUCTION固定四路径和全套markers（本契约、四生产路径、graph-camera-fit.test.tsx、graph-canvas-governance.test.ts）；缺任一个不得激活新的例外。
完整绑定后：Phase6真实committed-delta入口仅换用新选择函数，否则原PHASE6_KNOWLEDGE_POLICY不变；新策略必须检查完整delta，仅放行上述四生产路径和指定docs/tests/计划，不继承旧API/SQL/Core许可。visual验证器新增精确四路径分支，其余分支原字节保持；8F累计分支只追加四个精确免除，其余路径仍由旧violations裁决且旧protected-blob断言不删。新整站守卫以本次基线检查完整working+untracked、完整PR或current-main first-parent delta，不使用HEAD~1替代PR范围、不吞Git失败。
必须独立攻击缺任marker、混入API/旧SQL/Core/auth/AI/Wishes/全局UI/依赖/工作流/public/scripts/配置/无关图谱路径和旧准入marker组合的绕过；旧范围语义不变，新范围不得泛化。

## 5. 门禁与剩余工作

新范围先独立风险2 ADMISSION GO，再实施守卫适配/重新build与全套；已有隔离UI草稿不视为正式准入或发布。
主终局lint/TS/build、deterministic、全部真实PG/HTTP回归及真实Chrome desktop/mobile/cold-load/resize/filter/layout/zoom/keyboard/表格检查之后，fresh风险2精确全部文件candidate绑定；通过才能commit/draft PR→exact-head ownCI→不同fresh FINAL→受托ordinary merge/post-CI。任何候选内容改变使旧binding失效。
独立读/运行不冒充主全套第二次执行；所有任务客户端释放后才销毁精确owned合成栈，不清理正式数据或备份。真实AI配置用户稍后提供；04§13/整站完成/公开部署仍未完成，不自动申请8G。
