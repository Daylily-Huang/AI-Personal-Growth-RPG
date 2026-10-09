# 新用户入门引导：独立范围准入

状态：ADMISSION CANDIDATE。独立 Risk2 ADMISSION GO 前不改生产代码、产品正文或旧守卫；本文件不代表实现通过、commit、FINAL、merge、release、部署或整站完成。

接受基线：ee48b84ce989f1d2904e94116d300513d77ef3e4 / tree379aff57cc0f9e6a7600fcab00e0a1847f15fc52。PR53 reviewed8d665的整树一致，自身与post-main CI均终态success；3013匿名预览另经独立Risk1通过。旧04/05/06及全部历史失败、裁决、数据、备份和3010–3013预览保持，不修改旧准入文档。

## 1. 已核实缺口与产品依据

02§53–54要求渐进式首次使用，04§13要求注册→Main Quest→Skill→Activity→真实AI/确认/账本的完整十三步。用户已明确批准零XP手动技能目录；现有Quest、SkillCreateForm和QuickLog均已有独立服务端受控入口。

当前没有/onboarding。DashboardStates的fresh条件在任一Quest或Skill存在后即false，现有空态只提供“立即开始第一次记录”；因此不能只在空态放临时指引。此轮补独立引导页面、空态指引及加载成功后的DashboardHeader常驻返回入口，不改首页核心信息结构、QuickLog或全局导航。

这是02首次体验的窄L1呈现补充，按09§4在02原文末尾追加有日期的§73说明；旧全文及§72零XP规则原样，不引入任何新写入权限或L0规则。准备步骤完成不是能力、奖励、AI成功或MVP完成。真实AI配置仍按用户“等下告诉你”等待，不借用DSH或其他项目配置，不用mock代替真实验收。

## 2. 页面与行为范围

- 新/onboarding页面组合独立GettingStartedGuide客户端；此路径不在现有AppShell内，页面自身提供唯一main/h1和固定返回/dashboard链接，不修改AppShell。初始SSR/加载仅显示公共指引和loading，不嵌入用户数据。仅在下述公开配置guard与构建/运行绑定均成立的受控实例中，经现有GET /api/dashboard读取已认证私有事实；固定同源URL，credentials=same-origin、cache=no-store和受控AbortController，不接受账户或端点参数。
- 真实来源前置：现有getRequestRepository在公开Supabase配置缺失时会走DemoRepository，可能返回200及合法UUID，不能用401、类型或UUID冒称来源证明。GettingStartedGuide只检查编译期NEXT_PUBLIC_SUPABASE_URL和NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY两个公开值trim后非空；任一缺失/空白时清空事实、显示固定配置错误且不发GET，不按演示数据报准备完成。不得导入server/admin/env的私密读取器或读取/传递任何私密key。该客户端guard不能独自证明服务端运行配置，必须同时满足第7节同一构建/受控运行公开配置精确绑定；未经绑定的实例不在本轮真实来源GO范围内。
- 显示三个“入门准备”步骤：进行中的主线、当前技能目录、保存首条真实活动；分别使用固定本地链接/quests、/skills、/dashboard#quick-log-input。只导航到现有页面，由用户自行填写和显式提交既有表单，不复制新POST/RPC或触发自动创建/评估/确认。链接prefetch=false，避免额外后台导航预取。
- 主线判据必须来自quests中isMainQuest===true且status==='active'的实际条目，而不是mainQuest快捷字段（旧服务接受非archived状态）、普通Quest、客户端勾选或示例标题。已暂停/完成/归档的主线不标为“进行中”；无活动主线时仅建议去管理，不自动替换已有主线。
- 技能目录判据仅有效active技能存在。已有XP/Mastery的技能同样是已建目录，不要求或重置为零；“XP=0、Level1、M0、Confidence0”只描述现有手动建档入口的固定初始状态，不把当前技能状态伪报为零。
- 真实记录判据仅来自有效已保存Activity与非空rawInput，不由时长、输入草稿、AI提案、缓存、本地标志或示例判断。pending_assessment/assessed/confirmed只描述记录生命周期；记录存在不代表AI已成功、已确认、已获XP或独立验收通过。
- 只显示来自回执的必要名称和准备状态，示例明确标为示例，不预填写或伪造事实。使用React文本渲染，无dangerouslySetInnerHTML、任意外链、表单或可编辑成长值。
- 三步可自由跳过、返回或重复浏览，不强制顺序、不限制既有功能，不新增登录次数、streak、羞辱或“准备奖励”。后续显式解释AI只出Proposal，用户确认后确定性Growth Engine才结算；三步齐全也只称“入门准备已完成”。
- 401清空事实并导航到固定/login；网络/500/非法JSON/畸形回执采用固定安全错误与重试，不回显服务端错误，不把错误当空资料或成功。加载/错误期间不得把旧进度当新事实。卸载、重试乱序和迟到响应不得重新显示已失效数据。
- 不写onboarding_completed、profile、Activity、Skill、Quest、XP/Mastery/Evidence、Ledger、奖励或账户；不使用localStorage/sessionStorage保存完成状态、私有数据或凭据。用户在现有目标页显式创建资源的原行为不变。
- DashboardHeader只在原QuickLog动作区域添加常驻引导链接，保持问候文案、原按钮/callback及层级；DashboardStates只在EmptyState添加链接，原fresh判据、loading/error组件、权威说明和QuickLog动作原样。不能编辑Dashboard page、Quest modal、Skill page/form或QuickLog组件来扩大功能。

## 3. 回执与客户端状态的确定性承重

新纯progress helper只解释入门准备读模型，不引入成长/奖励算法。输入按unknown处理，要求自有dashboard/quests/skills/activities及相关自有字段、正确JSON类型、稳定有效UUID、已知状态、非空名称/原文；缺失/null/错误类型/原型继承字段、重复身份等畸形值fail closed。不得通过默认active、Boolean(string)、对象原型lookup或客户端onboarding标志报成功。

只使用三个是否存在的事实，不根据XP推定Mastery、根据Activity时长推定成长或根据AI数量推定能力；不修改输入对象或数组。可支持已成长老用户并按其真实条目解释，重访/刷新从服务器重算。精确接受字段和异常边界在新测试冻结；没有独立实现回归前不声称helper已经存在或已验证。

## 4. 精确二十一路径（相对接受ee48）

1. `src/app/onboarding/page.tsx`
2. `src/components/onboarding/GettingStartedGuide.tsx`
3. `src/lib/onboarding/progress.ts`
4. `src/components/dashboard/DashboardHeader.tsx`
5. `src/components/dashboard/DashboardStates.tsx`
6. `tests/onboarding-progress.test.ts`
7. `tests/onboarding-guide.test.tsx`
8. `tests/onboarding-governance.test.ts`
9. `tests/onboarding-http.test.ts`
10. `tests/helpers/governance-delta.ts`
11. `tests/visual-foundation.test.ts`
12. `tests/graph-canvas-governance.test.ts`
13. `tests/phase8f-ui-governance.test.ts`
14. `tests/graph-mobile-governance.test.ts`
15. `docs/Design ChatGPT/02_PRODUCT_DESIGN.md`
16. `docs/SiteReadiness/07_NEW_USER_GUIDE_CONTRACT.md`
17. `docs/SiteReadiness/08_NEW_USER_GUIDE_VERIFICATION.md`
18. `docs/MASTER_PROJECT_HANDOFF.md`
19. `task_plan.md`
20. `findings.md`
21. `progress.md`

生产只有前五路径（前三新建、后两窄链接），四新测试、五旧守卫适配、七文档/计划。没有目录级许可，也不自动批准未来额外文件。02仅末尾说明，不改旧规则。08/MASTER/三计划保留旧过程与裁决并标明当前门禁，最终GO后的事件用独立ignored receipt保存，不反写冻结候选。

## 5. 跨阶段治理闭包（先准入，再适配）

新selector仅在十一markers全部出现时生效：本07、02产品补充、五生产路径、四新测试。使用接受ee48为唯一当前范围基线；完整working tracked+untracked、完整PR分支及已正证origin/main==HEAD后的first-parent范围都检查精确二十一白名单。缺任何marker退回原规则，所有extras/旧Core-backend混入/配置/依赖/工作流均拒绝，Git解析异常fail closed。禁止用marker组合继承历史Core例外。

五旧适配具体限度：

1. helpers只追加新五production、二十一allowed、十一markers、新scope函数及十二new-additions常量；原所有policy/函数体/解析语义原样。visual入口仅增加优先严格newscope分支，旧所有分支与历史断言原样，去新增片段能还原ee48。
2. graph-canvas现有working累计ab84守卫新增独立new-guide分支：先对ee48原始tracked+untracked执行严格二十一检查；之后f100累计delta只移除已准入的十二new-additions（07/08/02、前三新生产、两Dashboard组件、四新测试），再用已有graphInteractionScopeViolations检查其余完整范围；最后ab84累计范围只再移除原CONNECTED_FOCUS_AUDIT_ADDITIONS六项和精确Knowledge page，用原graphCanvasScopeViolations裁决。旧Skills page、useGraphCameraFit、camera/motion等均不可过滤。未经首个ee48严格检查，不得启用累计过滤。原两个历史分支和全部旧合成断言逐字保留。
3. graph-canvas committed入口只在十一markers齐全时优先检查new二十一；否则原fullPR/current-main解析和旧分支保持。不得用HEAD~1作为feature-branch兜底或吞Git异常。
4. 8F current累计selector仅在十一markers齐全时加入精确五生产豁免；原violations、旧批准来源、七protected blobs和全部旧历史断言原样。新增专用ee48整范围guard承担完整白名单，不能因为旧8F批准过某路径就混入本轮。
5. graph-mobile-governance的真实f100 working守卫另加独立优先new-guide分支：先执行ee48原始tracked+untracked严格二十一检查，之后仅移除十二new-additions，对剩余f100完整delta仍调用原hasMobileGraphScope与graphInteractionScopeViolations。旧helper不扩白名单，原working分支、committed条件及所有历史断言逐字保留；移除新增分支/import须还原ee48全文。该第五守卫不是额外production或marker，十二过滤项也不扩大。Dashboard/Shared/AppShell等原scope policy对该纯引导范围并不产生冲突，禁止据猜测新增第六守卫或改其body。

新增独立回归必须攻击十一missing-marker、全部extra类别、旧bootstrap/graph/Core控制混入、全marker伪装、working/untracked、模拟fullPR和actual main-range、Git异常。原历史函数、断言和受保护blob还原/对照由脚本及独审验证，不删旧断言或放宽旧白名单取得绿色。本ADMISSION仅授权上述可实现方案，不是已有代码或通过的测试证据。

## 6. 禁止项与冻结外部常量

全部API、store/repository、Supabase/Auth/HTTP/SQL0001–0053、Growth Engine、AI/prompts/model/config、request ownership/RLS及Ledger不变；无新service-role、租户参数、API/RPC、schema、依赖/lock/workflow、PWA/集成/8G或公开部署。共享UI、AppShell/AppHeader/AppSidebar/MobileNav、global CSS/tokens、所有图谱源码/helper/事实/边/相机参数/对象身份及旧SiteReadiness01–06不变。

44px使用现有touch-target-min，md=48rem，normal duration250/reduced0只做冻结保持核验，不重定义。手动技能固定0XP/Level1/M0/confidence0和name200上限、trim25 codepoints复用0053及原0019/0052定义，不在guide重新实现名称校验/创建。奖励唯一不可变versioned v1函数0049经0050固定链保持八值：Season150；Major100/Epic150/Main或Boss200；MasteryM6/M8/M10=100/150/250。Reality仅记录0积分，Artifact认定与奖励双延期；不把任何这些值当入门奖励。

## 7. 实现、真实验收与发布门禁

ADMISSION：fresh独立Risk2只读核验本07全文、02/04/09、真实现有入口/SELECT/旧范围守卫、可实现模型和所有冻结常量，给出exact07hash-bound P0/P1/P2+GO/NO-GO。未GO不改五生产/02或旧验证器。

通过后主执行四新测试＋旧Dashboard/Skills/Knowledge/graph/visual/8F/authority/concurrency/HTTP/确定性harness，最终lint/tsc/完整生产build与真实PG全suite全部终态通过、零skipped/failed/unhandled（最终数量据实记录）。测试新helper畸形/prototype/UUID/状态/输入不变，实际React两链接、三个步骤、可跳过/返回/重访、401/500/乱序/取消、原QuickLog callback不变；公开URL或publishable key分别缺失/空白的四种实际Guide反例均须固定配置错误、零GET、零私有事实。

构建/运行来源硬门禁：受控验收及其后本机预览启动前，记录实际完成构建的BUILD_ID/HEAD/tree与编译期公开配置tuple（按现有env.ts的trim语义）；检查将要传给该唯一Next子进程的实际公开URL/key均非空且逐值等于构建tuple，并绑定进程cwd、loopback端口和该BUILD_ID。缺失、不同或无法证明一致时拒绝启动/接受guide私有事实证据，不发业务GET；不得仅核对客户端两个值存在就声称来源成立。至少覆盖“构建有配置、运行URL缺失”“运行key缺失”“运行URL不同”“运行key不同”四个负例，以及匹配配置正例，验证gate在派发Next/业务请求前拒绝。这属于ignored任务runner及新HTTP测试的验收绑定，不修改API/repository/env/既有预览工具，不新增追踪文件许可、不复制.env、不显示私密配置。浏览器/HTTP所有真实来源结论仅适用于该已绑定受控进程，配置漂移或绑定丢失立即失效；其他误部署实例不能借用本轮GO。

真实已完成build HTTP：匿名/onboarding只有公开shell，私有GET401且无数据；owner A/B scope、无缓存/重复请求带写入，固定links正确，现有新手资源创建/返回/刷新真实可用。synthetic测试mock AI只用于旧回归，不能说真AI完成。真实Chrome注册专用合成账号→指南→现有页显式创建Main Quest/零XP技能→指南重访→保存真实文字记录→回访读状态（不自动评估/确认）；如点击既有QuickLog产生旧受控mock评估须明确归类，不能改其原行为规避测试。已有成长用户、两个租户、401/error/重试及七宽度/44px/原生Tab均验。布局必须等既有AppShell过渡结束/geometry稳定再取证，旧快速resize截图裁剪风险仅为未验证历史，不是此轮已复现finding或共享UI许可。

构建/浏览器/HTTP仅使用新明确所有权的合成项目phase8f_test_new_user_guide_20261009_ee4、workdir.data/new-user-guide-stack、API54331/DB54332与专用Next3053，访问前核验labels/ports、完成build及私密fixture。正式54321/54322、3010–3013、restoreclone/所有备份不写不重启不删。filled双方Core/图谱/10表与奖励账户/账本基线，在仅访问guide和重访时前后严格不变；显式旧表单fixture创建的写入必须与零写guide浏览区分，不把fixture注册/创建当guide自主变更。

2026-10-09任务命名纠正：首次config使用phase8f_test_new_user_guide_20261009_ee48，已安装CLI实际生成的四组件labels一致为上述ee4，workdir及54331/54332正确；主原精确标签guard终态拒绝，未派发业务DB/HTTP。本修订仅将准入名称与实测task身份一致，不授权接受任意前缀、自动fallback或其他stack；config/runner在本修订fresh Risk2 ADMISSION GO后才改为精确ee4。旧F16A...准入和首次拒绝保留为历史，不复用其GO；五production/守卫/常量和21范围不扩展。

主门禁→fresh Risk2 candidate独占测试/actual counterexamples→直接永久DB_ACCESS_COMPLETE→主精确owned disposal→二十一hash/note binding GO→仅selected21 commit/draft PR→自身exact-head CI→不同fresh committed FINAL→受托ordinary merge/post-main CI；无admin/force/删分支。任何内容修正使旧build/full/browser绑定失效，按同风险fresh复验。真实AI、十三步及公开部署不因本轮通过完成；最后仍需用户项目AI和全部真实验收证据。
