# 连线键盘焦点纠正：独立补充准入

状态：ADMISSION CANDIDATE；没有准入 GO 前不改两 page 或旧范围守卫。不是候选 GO、commit、FINAL、merge、release 或整站完成。
接受基线仍为 f100d1fe10583d1b228e5ad23b0e9fded2730b25 / tree4cc70cb0d9be497234d546dd291282cb70235ab6；不以未验收工作树当接受基线。

## 1. 真实失败与旧证据保留

04 的两处 MiniMap 修改主 targeted164、lint、build/TS 已通过；真实 Chrome 24 条几何/交互记录通过七宽度、48rem 分界、44px 控件、desktop MiniMap 拖动/滚轮及 mobile resize/cold/zoom。最终 canonical controller guard 与 deterministic harness 合计52通过。上述不构成整轮验收。
实际新合成账号有每图四节点、三条保存的合法连线。Skills 原生 ArrowDown → Tab → ArrowUp 和 Knowledge ArrowDown → Shift+Tab → ArrowRight 均应回到上次邻居，却停在 Tab 后的节点。实际 API 端点及 DOMMatrix 布局独立计算期望值，非调用产品 helper 作 oracle。原始失败保留 `.data/graph-mobile-focus-browser-v1.json`；初始 BUILD_ID NXgcnfJC83ChQF2qPg9VG、24 条几何原始 JSON、8 回归首次4红/4绿全部保留，不能冒充修正后的绿色。
根因候选：两 page 只以 keyboardFocusId 作为新请求标记；再次请求同 ID 时 React 可跳过焦点 effect。nonce 相机请求变化不能代替焦点请求。

## 2. 精确补充范围

04 保持不可变（canonical SHA256134E00DFCACADDBE0F8F1A7D3E5F9A2A44F51F31044CC84BC14DCD7E7A656311），其两 Canvas 的 class-only 与全部禁止项仍有效。本文件只补充两 page 的“每次有效连线箭头产生新的视图焦点请求”，不得重构页面或改变 Graph facts。

新增生产两路径：src/app/skills/page.tsx、src/app/knowledge/page.tsx。每个 page 只新增独立 keyboardFocusNonce 状态、在已经算出有效 nextId 后递增此状态，以及将它加入原焦点 effect 依赖。原 keyboardFocusId、nearest-connected helper、筛选、camera focusTarget/nonce/offset/zoom/duration、selection、pointer、Inspector、router、fetch/写入能力全部保持。无邻居不得新增请求；禁止借 camera nonce 触发焦点，以免 pointer 选择误聚焦旧节点。
新增测试仅 tests/graph-connected-focus.test.tsx，使用真实 React+实际两 page 与实际键盘 helper，Canvas/网络的合成替身只用于确定性 orchestration；不得把该证据称为真实 Chrome。其余现有测试仍限04的六条，另仅 tests/phase8f-ui-governance.test.ts 可增加独立九-marker 准入后的两 page 精确豁免；旧 policy/旧 synthetic assertions 保持。
新增文档仅本文件；继续使用05、MASTER和三计划。相对 f100 完整候选十九条路径如下，无目录级许可：

1. docs/MASTER_PROJECT_HANDOFF.md
2. docs/SiteReadiness/04_GRAPH_MOBILE_OVERLAY_AND_CONNECTED_NAV_CONTRACT.md
3. docs/SiteReadiness/05_GRAPH_MOBILE_VERIFICATION.md
4. docs/SiteReadiness/06_CONNECTED_KEYBOARD_FOCUS_CORRECTIVE_CONTRACT.md
5. task_plan.md
6. findings.md
7. progress.md
8. src/app/skills/components/SkillGraphCanvas.tsx
9. src/app/knowledge/components/KnowledgeGraphCanvas.tsx
10. src/app/skills/page.tsx
11. src/app/knowledge/page.tsx
12. tests/graph-mobile-overlay.test.tsx
13. tests/graph-mobile-governance.test.ts
14. tests/graph-connected-focus.test.tsx
15. tests/helpers/governance-delta.ts
16. tests/visual-foundation.test.ts
17. tests/phase6-knowledge-ui.test.tsx
18. tests/graph-canvas-governance.test.ts
19. tests/phase8f-ui-governance.test.ts

## 3. 治理闭包

九 markers 必须全部出现：04、06、两 Canvas、两 page、overlay/governance/connected-focus 三测试。新 selector 优先检查此十九路径；缺一则退回原04十四路径或更旧规则，不能从旧 Core/bootstrap/graph markers 组合授权。原 MOBILE_GRAPH / GRAPH_CANVAS / 8F historical violations 和全部旧合成断言不改。
visual 实际入口增优先精确 selector；Phase6 实际 committed-delta 入口增四生产精确 selector。新完整 working+untracked 和 committed PR/current-main-first-parent 范围使用同一 selector，Git 错误不得吞掉。
旧 ab84 graph working 累计入口在完整新 f100 检查通过且九 markers 齐全后，只可排除04/05/06和三个新测试这六项 audit additions，以及原旧清单之外的精确 Knowledge page；Skills page 仍受旧清单检查。不得过滤其他 production。旧 committed graph 入口同样只有九-marker 的新完整范围可走严格 successor 检查，否则保留旧原检查。
8F 累计 current selector 仅九-marker 齐全时加两 page 的精确豁免，原 violations/旧批准来源/受保护 blob 检查不改。新完整 f100 十九路径检查承担全范围限制，不准目录豁免。独审攻击九种 missing-marker、任意 extras、旧权限混入和 all-markers 伪装，不能靠删旧断言获得绿色。

## 4. 修复与验收

先 fresh Risk2 ADMISSION：独立复现当前实际 React effect 的同目标重复请求缺陷，核验十九范围和治理可实现后，才改 page/守卫。新回归必须在旧 page 上先真实失败；修正后新 targeted/lint/TS/生产 build、旧 camera/identity/motion/Skills/Knowledge/keyboard、全部真实 PostgreSQL/HTTP 与 deterministic harness 重新终态通过。
新真实 Chrome：04七宽度/48rem/44px不变；有边四方向/最近邻/反向/Tab间插/重复同目标、无邻居不误跳、Enter/Space/ Escape、手机表格/列表和桌面 MiniMap 交互；正常 camera duration250与reduced-motion0保持，不能以假DOM焦点或mock代替原生按键。Skills与Knowledge原Graph facts/XP/Mastery/Evidence/reward十表前后严格一致。
奖励八冻结数 [150,100,150,200,200,100,150,250] / IMMUTABLE，XP与Mastery独立、现实成就0、Artifact认定/奖励双延期、RLS/Auth/SQL/API/Core/AI/环境依赖/导航/共享UI/旧02/03和04一律不改。
只用已验证所有权的 phase8f_test_graph_mobile_20261009_a/API54331/DB54332 或新同样独立合成栈；正式54321/54322、3010/3011/3012、恢复副本/全部备份不写不重启不删。fresh candidate/独占grant/直接DB_ACCESS_COMPLETE/精确owned disposal/最终十九hashbinding GO 后才commit。不同fresh committed FINAL+ownCI通过才受托 ordinary merge/postCI，禁止admin/force/公开部署。任何修正使旧build/browser/fullsuite binding失效。
用户真实AI稍后提供，全新用户十三步/新用户引导及公开部署仍未完成；本范围不改变系统规则、用户选择或授权边界，不标记整站完成。
