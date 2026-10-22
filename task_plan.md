

# 商用质量优化总计划

原始目标：继续优化网站，参考成熟同类项目，达到可商用的产品质量，符合用户习惯、考虑周全；常规产品选择按推荐执行。目标保持 active，不能以第一轮界面完善代替整体完成，也不保证抽象的“零缺陷完美”。

当前基线：PR71 / c02f4cc2eb8486f185b83399086788047d51505e，原桌面网站3021，Next16.3.1，正式数据库0056。启动校验确认运行版本与生产源一致；正式数据不写测试内容。

## 已证实的问题
- AppShellBoundary只覆盖5组产品页；journey/rewards独立创建Shell及Provider，跨区域丢失导航状态；local-library与活动详情脱离统一壳。
- MobileNav把7项一级入口同时塞入底栏；无统一页面/操作检索入口。
- src/app没有自定义error/global-error/not-found/loading处理；next.config为空，商业安全头待审。
- Login仅注册/登录，账号恢复、数据导出、设置与公开隐私说明待完整审计；不能仅凭文件名缺失宣称全部功能不存在。
- 历史release范围守卫把当前项目长期绑定到旧变更集，需要区分历史入场条件和新版本授权，保留核心安全测试。

## 验收矩阵（每项必须有当前版本证据）
| 阶段 | 用户结果及完成条件 | 状态 |
|---|---|---|
| 1 导航和恢复 | 全产品一致导航；手机4入口+更多；页面检索/键盘/焦点恢复；帮助；404、加载、局部及全局错误可恢复且不泄露异常正文 | 实施中 |
| 2 安全和AI成本 | 服务端身份/跨账号、同源、请求大小、限流、超时、秘密与日志；依赖风险、响应头、生产配置；恶意/并发/会话过期实测 | 待审计 |
| 3 任务与记录体验 | 今天主线清晰、快捷添加、未保存防丢、明确保存状态/未知结果原请求重试；搜索/筛选/排序；空/错误/慢网；统一中文/视觉 | 待审计 |
| 4 账号和数据控制 | 登录注册邮箱确认/密码恢复/登出，账户隔离；本人数据导出和已备份恢复演练；删除流程须先核验候选、绝不执行真实用户删除测试 | 待审计 |
| 5 全端品质 | 320/390/768/1440，200%缩放，键盘/屏幕阅读语义/焦点/44px/对比度/减少动效；真实数据规模性能与请求预算 | 待验收 |
| 6 运营与交付 | 受控配置、健康检查、备份恢复、升级回滚、错误诊断无秘密、依赖/素材许可清单、使用帮助、生产发布检查 | 待实施 |
| 7 商业上线准备 | 准确隐私/AI处理说明、条款草案、联系/经营主体/司法辖区与计费渠道需真实可核信息；公开发布另行按已授权边界执行，不因“可商用”自动收费/发布 | 未完成 |
| 8 最终审计 | 每条需求绑定最终SHA；完整CI/合成DB/真实浏览器全流程、边界/失败恢复/跨账号与备份恢复；独立最终GO；本机交付和临时缓存清理 | 未完成 |

## 成熟产品参考（2026-10-23查阅；只借鉴交互原则，不复制品牌/素材）
- Todoist Today：https://www.todoist.com/help/todoist/get-started/plan-your-day-with-the-today-view-UVUXaiSs —— 聚焦当天任务与可执行优先级。
- Todoist Quick Add：https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz —— 低成本快速捕捉。
- Linear Search：https://linear.app/docs/search —— 可发现的检索/键盘入口；本轮先明确仅搜索页面与操作，不冒称业务数据全文搜索。
- Habitica：https://github.com/HabitRPG/habitica —— 现实任务与游戏反馈；本项目保留无惩罚/无强制签到/不把时间当XP。
- Super Productivity：https://super-productivity.com/privacy/、https://github.com/super-productivity/super-productivity/blob/master/docs/wiki/3.06-User-Data.md —— 用户控制本地数据、明确外发边界和导出风险。不能照搬其隐私承诺，本项目明确使用现有云端AI。

## 实施与验收约束
不重搭站点，不实现3D、大型技能树重制或音效。保护root既有脏文件、聊天、密钥、原文件、数据库与备份。新代码在D盘隔离树；临时脚本/profile/截图放同轮scratch；阶段验收后清理可再生成临时件。每个垂直切片先真实自检，再按风险做最多首审6次+定向复验4次/累计10分钟的独立核验；不重置预算。CI绑定精确候选，普通合并及合并后CI通过才更新原桌面入口；公开发布、收费、正式DB操作不推断为已授权。

## 当前推进
上一轮属于实质进展：多目录已合并、接入桌面并清理。本目标第一轮已完成当前源码/运行版本核对与成熟产品调查，正在实现导航和恢复。全目标仍active；后续范围不得缩成只修外观。
> 2026-10-17 图片OCR候选自检通过：210相关测试0失败/跳过、type/lint及生产构建通过；真实Windows与Chrome四格式/编辑撤销同意/空白/原图变化/390px通过；虚构笔记调用既有真实AI，隔离账号确认前0写入、后1活动+E0未验证材料/0 XP。完整隔离回归运行中，发布仍需独立有界验收与CI。386生产源绑定，原AI/确认/数据库/供应商不改。

> 2026-10-17 图片文字识别进行中：基于PR68，仅补文件夹PNG/JPG/WebP/BMP本机Windows OCR、可编辑预览和核对后AI同意；原图不落盘或发云端，不改变既有AI供应商/确认/E0/数据库/XP。计划：相关回归→真实WinRT与隔离账号浏览器→有界独审→PR/CI→原本机入口更新与临时清理。控制docs/SiteReadiness/28_LOCAL_IMAGE_OCR.md。

> 2026-10-17 本地Office读取已实现、待独审及发布：PPTX实际页序/备注，DOCX正文/表格；浏览器本地解压提取，20MiB文档限制，超限或损坏整批不发送。146相关回归、type/lint/Turbopack构建与真实Chrome标准Office夹具通过；本轮AI/认证接口使用合成拦截，未调用真实云端AI或写正式数据，沿用PR66已验确认/E0逻辑。旧混合环境首轮432项有9失败，原记录保留，当前146已全通过；完整回归以洁净CI为准。

# AI Personal Growth RPG — 项目总体计划与当前状态 (Task Plan)

- [2026-10-16 LOCAL_LIBRARY_IN_PROGRESS] 基于PR65新增只读指定文件夹、选择后云端AI整理、编辑/拒绝建议、确认后活动/E0证据。计划：隐私澄清（完成）→实现/专属测试（首批49通过）→隔离真实DB/浏览器/全套/构建→有界独立exact-head审查→普通PR/CI与本机入口更新→精确清理。正式数据、原文件和备份保留；README同步PR59–65。下方待合并快照为历史，不覆盖PR63/64/65已交付事实。

- [2026-10-15 EFFECTS_SELF_CHECK_COMPLETE] 游戏效果七项已实现；原144相关+27仪表盘检查通过，最终12反馈/偏好用例复验通过；最终构建kzdw9_qZCDivnLae1GF3c、type/lint通过，实际Chrome桌面/手机8组+偏好2组通过，零页面错误。确认处理器原文保持；真实独立测试库结算99→103 XP、等级1→2、重复409及账本保持，provider明确为本地确定性测试端点，不冒充真实LLM。测试栈4容器/专属卷已精确清理，正式数据不写；8路径候选待有界独审、提交/CI/本机交付。

- [2026-10-15 EFFECTS_POLISH_IN_PROGRESS] 用户要求游戏效果更精美、特效更多；沿用暖金墨色界面。实现分层入场、卡片高光、XP流光、真实入账粒子/涟漪、真实升级徽章/光环和本机动态效果开关；保留OS减少动态设置。只扩展已有3处展示文件及相关测试，确认处理器、引擎、API/SQL/RLS和奖励不改。先相关自检/实际浏览器，再有界独审/版本绑定/CI和本机交付；临时件只放D:/_scratch/2026-10-15-rpg-effects-polish。
- [2026-10-15 SELF_CHECK_COMPLETE] 月度自然月/上月对照及回执结算反馈完成；最终全量163文件/4730通过，0失败/跳过，type/lint/build及真实AI13步、月度7组浏览器通过。26路径候选待有界独审和受托交付；细节见docs/SiteReadiness/24_MONTHLY_REVIEW_AND_GAME_FEEDBACK.md，最终状态见.data/monthly-review-20261015/completion.json。


- [2026-10-15 IN_PROGRESS] 基于已合PR62/0398f69f复用日周复盘完成月报与上月对照、结算短反馈。当前隔离分支codex/monthly-review-game-feedback-20261015；依次实现→边界/回归/构建/真实浏览器→有界独立验收→本机交付与精确清理。无3D/大技能树/音效/公开部署/数据库迁移；正式数据及恢复备份保留。

- V6纠正最终主验接点：20全文5112C0AFF160F85527C171EE0DB2CE3BF752F41786BB0CD1F5BF1F7EDB20B934／EXACT46／25markers／旧53交21并集78。主corrective-full-v3/session80420真实151files4358/4358、0skip/fail/unhandled、child0/null/null，2026-10-11T21:27:03.397Z至21:48:38.728Z，rawC68EC55FC2AE7BC983E2330CE44D431F919D64E30C09870E6E165C73A65F185E；分批119+116+234=469、最新type-v4/lint-v4均0无warning、原Growth11保持且全套再通过。Turing自己235/0skip终态0及477拒绝/17到达标志通过，旧116全文/model/body/helper前缀与历史data/current46分离；不是其二次full/browser/DB，旧171永久释放仅同生产历史。357生产源/13business及buildRze/主Chrome31同源不改。主417f23确认taskRuntimeResidual[]/mainreleaseBC7598694FB78EACB809670383D743C93790F54A1D0BEF292032FD53AF97D97E；随后89183→d37cc3只精确新four-ID测试栈4容器1卷清至0/0、nonTask全部ID/state保持，disposal6F9646A95C9C67BF87F547B258959ADBF8A333F0B481F6ECF723EEA92583E795，当前cache不存在/删除0bytes，原119864600bytes是之前开发栈阶段已回收，不能重复计。全部历史NO-GO、V4的2fail、V5的3fail/negative提前fixture假绿、v19原总300s截断及新no-op mutation失败、误报8→实际7等如实保留21。现九docs/46待最后窄hash绑定，不预签candidateGO；之后仍selected corrective commit/new ownCI/不同fresh committedFINAL/新栈释放清理/ordinary merge/postCI。0056未正式授权，现3020/0055、完整备份、共享deps及root四用户文件保持；不称真实AI13步或整站完成。

- V6独立OWN_OFFLINE_COMPLETE已收到：Turing own2files235/235/session31596 exit0/0skip/nonpassed/unhandled、212.88s；额外477拒绝反例+17目标到达标志，旧116全文/modelbody/helperprefix及历史data不替代current46证明通过，四hash前后不变、357源同源，本轮无reviewer工具错误。尚非candidate GO；旧171仅历史、永久noDBHTTP不撤回。主随后启动corrective-full-v3/session80420，2026-10-11T21:27:03.397Z/worker803142，Rze/357源/原same-owned四容器，未终态不宣称全绿。终态0后才mainrelease→精确清理→46冻结→Turing≤6calls绑定→纠正提交/新CI/不同FINAL/merge；正式0056仍另批。

- V6纠正定向已终态：unit-v20新governance119/119/session66226 exit0；v21原proposal-edit-governance116/116/session71953 exit0；v22其余4files234/234/session66702 exit0，合6files469passed/0fail/pending，原30秒用例26347ms。latest type-v4/session30789与lint-v4/session1443 actual0无warnings。Turing已得到仅OWN_OFFLINE_READY，独立主要变更2files235及静态反例复核，永久noDBHTTP/无writer；主等其终态再full-v3，不并行Git。V5full3fail及v19partial/no-op mutation历史保留；未候选GO/未纠正提交/CI/不同FINAL/合并/正式0056。

- V6已独立ADMISSION GO：Poincare0/0/0，完整20 raw/canonical5112C0AFF160F85527C171EE0DB2CE3BF752F41786BB0CD1F5BF1F7EDB20B934，46/25/21/78不变后窄实施。原proposal-edit-gov仅model定义唯一rename、directvalidator alias与顶部适配，原116body/expect保持；append-only真实历史5168→229c provider和唯一UUID逆向、原execute/calls/controls/显式providers保持，current入口仍自身strict46，通用legacy分流未改。新8测试覆盖整份inverse、真实历史data不是scopeproof、override/accepted/非Artifact以及注入到达轨迹。主type-v3/session94741实际0，unit-v19六文件/session14071与lint-v3/session39356进行，不冒候选GO。20初次append少一空行hash差异被检出、先精确修正再验证；ignored parent ceiling一度改600000但从未执行，恢复原300000后才运行，原per-test timeout全不改。旧V5完整3fail及负例提前失败历史保留，正式0056仍未授权。

- V5完整终态NO-GO：corrective-full-v2/session99191→d92f6f actualexit1/null/null，2026-10-11T20:40:28.298Z至21:00:57.240Z；严格JSON151files4351assertions=4348pass/3fail/0skip/unhandled0，raw42703A92CD0B3CE6886E91E9619D9FCE82C3E558B043B3DCAA3FF4A36382C3C6。唯一旧proposal-edit-governance116三项fixture inverse阻断，其他150文件passed；旧API21、旧30秒内容用例26731ms、新112/42/12/12/UI17及growth11passed。不据此签GO。主最后真实comm/cwd taskClients[]，全部测试进程已结束；合成四容器待纠正重跑后精确清理。V6仅ignored外部draft5112C0AFF160F85527C171EE0DB2CE3BF752F41786BB0CD1F5BF1F7EDB20B934正式同级ADMISSION进行，candidate20/helper/tests尚未改；旧否决及部分negative提前fixture假绿均保留。

- V5主定向终态：unit-v18/session39349实际5files346/346、0fail/pending、child0；原30秒内容用例27315ms，未改timeout或断言。corrective type-v2/session14568与lint-v2/session69321均child0/null/null。Turing正在同Risk2永久离线纠正复核，独立运行终态前主不启动full-v2避免Git争用；完整候选/纠正提交/新CI/不同FINAL/合并/正式0056均仍待。生产357/buildRze保持。本次恢复先猜错21文件名的只读ENOENT后由rg定位真实21，无文件影响。

- [V5 admitted / corrective verification in_progress] V5 correctiveADMISSION已Poincare独立0/0/0 GO绑定20 canonical451AA77072E31B9D574D37FC1FA44A24949999093A645E6F167A6B5DAD20C27E/native wrapper E0CE7AA80B88EC46342AF941FE13004F0D5488799996F0225FF9E8CDDEC40D0C；旧wrapper仅子命令白名单可带--output的P2 NO-GO保留，现14合法/59拒绝、3真实rawsame、31漂移/176逐次Git失败/5binder反例独审通过。EXACT46/all25/old53交21/cumulative78；本轮只改旧API fixture首个activityId为合法固定v4 UUID，原21全部body/assert/mock及负例原样、全文inverse；newhelper当前同步proof减少重复、结束HEAD/remote及3原文重读漂移拒，原prefix不变。主type-v2/session14568实际终态0，unit-v18五文件与旧30秒性能实跑中，未候选GO/未完整绿。原4347/2fail历史不删，357生产/SQL/buildRze/原Chrome31同源，0056未正式批准。补丁预生成74819tokens输出截断被检测、未用截断文本apply；主精确重构完整旧append/新append及完整20/governance、旧API唯一一行后才apply，不冒称原生成成功。

- [NO-GO / V5 admission pending] V4 full-v1终态NO-GO：151files4347pass/2fail/0skip/unhandled0，rawCFC331672B0A6CDF5509E308B1C0AE1CC0648D3A6F77E432CCA53049874FEEA8；旧API21内1失败因合法随机UUID含99969触发原/999/断言，旧contextgov157内1失败为原30000ms限时。新业务和Stage7C29均过不代完整绿。初次成功预设JSON断言失败是主工具错误；滚动regex漏failed行，只统计pass，已明确向用户纠正。V5外部draft124E3B8A0EDDA1400753AE1C6F0CBAD132C223C07EAA630D38B64E297F47AD16待独立准入，拟第46旧API仅一处合法固定fixtureUUID，原全部assert/body/mock/timeout不变，old53交21并集78；未实施V5。native真实WindowsGit实测三命令raw同，diff277ms/Linux627ms；只改ignored调度不fake/cache/放宽timeout。主所有DBHTTP运行已结束，新测试栈idle未清理；正式0056/3020/数据备份保持。

- V4主定向unit-v15已实际终态0：3files166/166＝新governance110＋原Dashboard27＋原Stage7C29，fail/pending0；raw .data/artifact-manual-unit-v15.json。corrective type-v1/session71649与lint-v1/session71220均child0/signalnull/errornull，生产357源逐项保持。主corrective full-v1/session92725正在新four-ID合成栈真实运行，未终态不宣称全通过；独审Turing仅offline延续，永久DB释放不撤销。

- [V4 corrective in_progress] V4纠正准入已由Poincare同Risk2直接P0/P1/P2=0 ADMISSION GO，绑定20 canonical03A26A6ECAE2923D5E3473260E0A7FAAA3CC210F9E4D43501DC6800FA39F7C32，EXACT45/all25/old53重叠20/cumulative78。仅新增旧Stage7C最前alias/wrapper，原29整份逆向保护；helper accepted5168全prefix不改，当前e0a仅精确SHA/tree/remote5168/冻结44+E68过渡，exported committed binder及新HEAD仍strict45。生产13、旧55SQL、buildRze全部357源不变。ownCI38167679925及Harvey FINAL P2 NO-GO保留历史；主unit-v15/newtype/fullsuite待终态，不能合并。正式0056仍另批、3020/源数据/完整备份/deps不动。新的四ID FINAL合成栈复用于主纠正，结束后另作精确清理，原disposal不覆盖新栈。
- 工具历史：本次生成补丁先误以Stage7C使用双空格缩进，count=0的assert在任何apply_patch前阻止写入；改按真实\s*it计数29。另一次猜测ignored unit.cjs不存在，rg定位真实unit-runner；不属于产品缺陷，不冒称首轮成功。


- [complete Artifact44主/独立运行及精确清理；pending最后离线candidate GO] actual full-v2 151files4346/4346/0skip/unhandled/status0、219/type-v3/lint-v5/buildRze/Growth11/主Chrome31/三ownerCore保持；Turing自己171/171/只读117函数+八值+33helper拒绝后直接永久释放。主34588→97a855仅原4容器1卷→0、cache119864600B移除、nonTask/数据/完整备份/3020/deps/root四保持；21失败历史不删。当前九docs/全44冻结→最后candidate GO→selected44commit/ownCI/不同freshFINAL/新栈清理/ordinarymerge/postCI。正式0056另问、获准后新完整备份恢复独审；当前未提交、未正式升级、未整站完成。

- [in_progress Artifact44 full-v2] 独立Turing171/171、session47528终态0并直接永久释放；主219/type-v3/lint-v5均0。full-v2/session72149正在全套回归，未终态不清栈。之后精确owned4容器1卷/cache处置→九docs/44manifest冻结→Turing最终离线candidate GO→selected44commit/ownCI/不同freshFINAL/ordinarymerge/postCI。正式0056另问、重新完整备份恢复独审；3020/数据/现备份/共享deps保留，旧所有失败保留21。

- [in_progress Artifact44] full-v1真实4344/1唯一旧Dashboard治理失败；Poincare独立ADMISSION V3 E68/all25 GO后仅增第44文件最前3wrapper、原27整份逆向、旧helperprefix保持，累计77不误加1。type-v3已0，新unit-v14→主全部client census/独占171独审→永久release→correctedfull-v2→精确清理/44冻结/candidate GO；之后44commit/ownCI/不同FINAL/merge/postCI。正式0056另问，新备份恢复独审不能省，3020保持。

- [in_progress Artifact43纠正验收] 三独立P2全部实施修复，新build-v3 Rze通过；主Chrome-v4 31checks/四宽44px/原key重放/保存回执与3owner全表Core/XP500level4保持通过。主完整full-v1进行，fresh Turing同Risk2纠正待；旧target432、独审NO-GO、各fixture/工具失败均保留21。正式0056无许可，3020正式0055预览保持，owned清理待双方永久释放。

- [in_progress Artifact20] 用户批准手动验收/首次100愿望积分（非XP）；独立纠正ADMISSION43/25 GO，候选0056＋新服务端/Inspector面板/旧UI唯一文案断言已实现。主v8真实PG50/50、v6UI15/15；下一步新HTTP/治理与所有旧功能回归、type/lint/build/fullsuite/harness/Chrome→fresh Risk2候选→selected43/ownCI/不同FINAL/普通merge/postCI。正式0056另问用户且新备份恢复独审，不复用0055许可。最终精确清理合成栈/无引用缓存；3020/正式数据/密钥/备份/共享deps保留。详21，失败历史保留。

- [in_progress 纠正35最终离线绑定] source/build-v2 mLc保持，main完整133files3379/3379、Growth11/E2E11/type/lint0、新Chrome61/真实两路取消/契约四宽八geometry3Tab/3owner36表parity通过；旧20/8fail、3376/3失败与303预算复核保留。主全部客户端退出/release-v2/census[]，原4containers1volume精确清理0/0、formal11/10/nonTask/source/protected保持，disposal39DA...05F95。controller16固定/仅panel+UI8regress及六auditdocs变；完整35与17冻结待Ramanujan sameRisk2最后candidate GO，之后selected8新commit→新ownCI→不同fresh committed FINAL/新栈清理→普通merge/postCI→正式54当前批准/备份恢复独审→新preview/cache清理。现3018/正式数据/密钥/备份/deps保留，整站未完成。

- [in_progress PR59 committed FINAL P2纠正] fresh Ramanujan0/0/1 NO-GO已永久DB/HTTP释放；旧source8新增回归全失败、修后166offline/type/lint0。仅production面板与新增8test/六auditdocs变化，controller16不改。main独占同一新合成栈新build-v2/full/Growth/E2E/四宽Chrome/36表快照→新release/owned清理→同Risk2候选复审/35freeze→新selectedcommit/ownCI/不同fresh committed FINAL，之后才普通merge/postCI。正式54当前批准待，3018/数据/密钥/备份/deps不动，整站未完成。

- [in_progress 最终35离线绑定] Leibniz独立257/115/62/SQL8/3owner36表通过并永久释放，原P2宽度证据缺口已主实际补齐320/390/768/1440/八geometry/3Tab/零error/零businessPOST，source28未动。主纠正客户端全退、新release-v2后精确销毁原4容器1卷，task0/0/formal11/10/nonTask保持。17/七文档冻结待最终manifest GO；所有提交/CI/不同FINAL/PR/正式0054/新预览仍待，3018保持。

- [in_progress evidence35 fresh Risk2] 主完整133files3371/3371/child0，build9l8oQr59O_o4dqIkTboeI/type/lint/Growth11/E2E11，Chrome55checks/30API/8geometry/3nativeTab/0pageerror、三owner36表原记录不变通过；旧失败保留17。main所有客户端退出/census[]，已direct给Leibniz指定独占真实DB，待永久release→owned disposal→35最终冻结/候选GO。无提交/正式0054/整站完成，3018保持。

- [in_progress evidence35 完整构建前验收] 最新主offline-v5 158/158、真实PG authority-v3 34/34，两个child0/zero非passed；原失败与修复过程见17。尚未build/HTTP/browser/full/候选GO/提交/正式0054。下一步type/lint→completed build→真实Auth/HTTP，现行3018保持。

- [complete 所有运行/精确owned清理；pending exact25候选最终绑定] Lovelace自己565v2/156/readonlySQLv2终态0，直接永久释放；旧v1 raw覆盖和SQL-v1夹具失败公开分层保留。主72992原4容器1卷→0、正式11/10/全部nonTask IDs/state不变，disposal589176...F46BE；source18/build4/full2780/Chrome相同，七docs冻结后外部25manifest。候选GO前不commit；后事件不反写冻结25，仍需ownCI/不同committed FINAL/ordinarymerge/postmain/accepted preview，不是整站完成。

- [complete 主实现/全套/Chrome；in_progress fresh候选] currentbuild4 KwxsbCEmj_h6hYEjzgJ1g/source18冻结，unit86/real目标51/full119files2780/Growth11零skip实际0；主Chrome四宽八44px/nativeTab4/取消/网络abort重试/持久原文/其它Confirm14XP/空列表成功过，35表仅预期status+Confirm delta/ledger parity。QA/浏览器/PG已闭/root只读preflight通过，显式grantLovelace后主不再DB/HTTP，等待独立永久release后只做精确owned清理；候选final/owned4+1清理/25冻结尚待，不commit/merge/sitecomplete。

- [in_progress Reject同源修复验证] build3/port夹具修正后目标仍50/1；仅新route采用旧login-http Host边界+四反例，unit5/build4进行。保留旧失败；新目标/full/Chrome/fresh候选/精确清理和25冻结尚待，不提交/合并/宣称整站完成。

- [in_progress Proposal Reject Round1] accepted78d/tree9a85；BB98合同经Bernoulli纠正ADMISSION GO后实现4production+六tests/八旧guard窄适配，exact25/all12。主unit-v4三files82/82/lint/type终态0只证明当前接口/UI，不代真实PG/完整回归/浏览器/fresh candidate。生产无SQL/权限/XP/AI/依赖变更，Dashboard protected blob保持；reject只status CAS。后续真实两锁序/双拒绝/sibling/三owner snapshots→completedbuildHTTP/full/Chrome→freshRisk2→永久release/owned清理/25冻结→selectedcommit/ownCI/不同FINAL/ordinarymerge/postCI/accepted预览。未准候选GO不得commit；Edit/补证/Verify/最小AI上下文及整站仍未完。

- [complete main / in_progress independent corrective candidate] Aquinas ADMISSION785DC后仅selected7实施；主before419/1、corrected-v1九文件491/491零skip真实terminal0与原及恢复重复lint/type0均记录。五docs/全7现冻结，fresh Gibbs自己offline/actualGit/反例/final7绑定待，未候选GO不commit。本轮不建本地DB/HTTP/browser/build；15非selected和全部生产/权限/SQL/常量不改。之后selected7→ownCI真实完整PG→不同fresh committed FINAL→普通merge/post-main成功→accepted预览→精确无引用缓存清理；未验预期2539不是结果，旧3015与正式数据保留，整站Edit/Reject/Verify另受控阶段。

- [in_progress 2026-10-10 post-main纠正] PR55 ownCI/FINAL绿而主38046256511两job同actual historicalcaller失败。Aquinas独立11calls ADMISSION零finding GO（785DC...14079）仅selected7/all3；main未改test前419/1精确复现。追加严格分类helper、保留原prefix/历史assert、同调用者三拓扑反例；所有src/SQL/AI/依赖/09原样。新offline/type/lint/实际Git探针→fresh候选7冻结→selected7/own realPGCI/不同FINAL→ordinarymerge/postmainCI→accepted预览及无引用缓存清理均待；当前3015/正式数据/备份/root保护保持，发布BLOCKED。

## 2026-10-10 — Activity 原文详情（当前，旧记录保持）

- [complete 主实现/纠正验收冻结] 新build1z926/TS/lint、offline420/full113files2468/standalone22与主Chrome严格13步/长原文/六宽度/原生Tab终态0；首P2 NO-GO保留，仅两test纠正。Ohm自己420/512+SDK102及独占134/readonly8/prosrc/RLS通过，DIRECT永久释放后主原4容器1卷→0，D51304...13093；正式11/10/备份/3015/root四保护保持。
- [pending 冻结时点后续] 七docs/全22离线manifest候选GO→selectedcommit/own exactCI/不同fresh FINAL+新栈/新清理→普通merge/postCI/accepted新预览与临时缓存清理。后事件记ignored回执/根三plans，不反写冻结字节；不把主13步或本轮GO当整站完成，下一受控阶段核定Edit/Reject/Verify。

- [complete] main c06/tree8f14与root7dirty保护；09独立Sartre ADMISSION零finding GO，仅准入。
- [in_progress] exact22/all10/exclusive11：私有GET/详情页/两个实际activityId入口、新API/UI/HTTP/governance与七旧guard窄兼容。
- [pending] direct-Node目标/保护回归、lint/type/build、专属PG全套/harness/E2E、真实Chrome严格13步与长原文/手机/原生Tab/错误态。
- [pending] fresh Risk2 candidate/permanent DB release/exact disposal/22manifest→selectedcommit/ownCI/不同FINAL→委托ordinarymerge/postCI/accepted预览/安全临时缓存清理。
- [pending] 整站完成审计；单项准入/功能GO不改写完整用户goal，不擅自公开部署。

## 2026-10-09 — 新用户指南（当前阶段，历史记录保持）

- [complete main/independent runtimes and exact cleanup; pending final21 hash-bound candidate] 主build/lint/tsc/harness11/340/durable109files2254exit0以及新Chrome/三owner10tables保持过；freshLeibniz自己153/memory/授权340/readonly8+prosrc/2RLS/cacheparity过，永久release。主62ab30→e73d9a精确task4容器1卷→0/receipt124632...ACF3D，正式11/10/备份/旧previews/root四dirty保持。extra26 tmpGit边界失误披露排除strictproof，旧NO-GO/unknownexit/raw均保留。七docs/全21冻结送其最后离线绑定，未candidateGO不commit；之后ownCI/不同freshFINAL/merge/postCI仍待，realAI/十三步/整站未完。

- [complete durable main full; in_progress fresh independent exclusive DB] v3真实terminal0/109files2254全passed/零skip/raw96A815...CD7E6/terminal113EB3...D3C78、14source/.next保持，maincensus[]/QA3053closed后明确freshLeibniz独占grant ONLY指定340及readonlySQL。主停止DBHTTP；其153/memory通过，extra26临时Git边界失误披露排除strictreadonly，待ownDB/release/主清理/final21。未candidateGO不能commit。

- [NO-GO incomplete gate; in_progress durable full replay] McClintock153静态/offline零finding但无DB独验/最终21故NO-GO已close。v2full实际109/2254全passed，但原session回收未知exit不能补0；保留全部raw，只ignoredwrapper新v3/65679捕获durable终态。source14/.next保持，新freshRisk2/full范围与340/SQL8/grant/release/disposal仍待，不commit。

- [complete corrected main browser; in_progress corrected full / fresh Risk2] 新Chrome4flow+20geometry/tab/error+2grown/real401，全新v2fixturecoherentXP500/Level4/M8，三owner十表A9EE...D78C8A实际rollback读前后相同；仅ownQA/3053精确结束，旧preview保持。66349纠正完整livePG/HTTP正在运行，source14/.next冻结，独审先offline、不DB/HTTP到显式grant，未GO不commit。

- [complete corrective narrow gates; in_progress browser/full/fresh Risk2] 新build nPykPa9YZVfieKwMF1QUv/43pages/TS、lint0、actual配置四负例0dispatch、实际九文件340/340零skip（旧HTTP18正确匹配）已过。新3053开始；只测试fixture纠正，production五文件原hash，旧P2 NO-GO与所有历史保持，不能commit。

- [complete first validation; NO-GO historical] 首full109/2254零skip/980B...9885、Averroes153/44/9/16已终态；独立P2 fixtureLevel不一致使候选NO-GO，旧green/14manifest/原HTTP603C/build-v1保存。
- [in_progress correction] 只newHTTP用现有playerLevelFromXp及双方DB XP/Level parity断言、syntheticfixturegroup；production五路径不变。新build/target/browser/fullsuite/freshRisk2待，不能提前commit。

- [in_progress fixture correction queued after active suite] 冻结等级函数XP500实际4，newHTTP夹具目前写2。Guide只读准备不消费等级，但须补一致fixture；不改正在运行80149的14source/test，终态后仅新HTTP用existing deterministic level helper并重验。所有firstgreen历史保留，Averroes未DBgrant、不签candidateGO，新同档审查后最终绑定。

- [complete main build/live target/browser] newbuild43/TS/实际CkE0QxeLA0RX-dnt764no、final lint0，real八文件322/322零skip；Chrome真实旧注册/MainQuest/zeroXP/rawsave→guide重访、20geometry/tab/safeerror及2grown/real401通过，三owner十表严格CE0739...EAAB4不变。真实AI缺失502未XP/assessment，不称全十三步。QA仅3053精确结束，旧preview保持。
- [in_progress fullsuite / independent candidate] cd5d46/80149完整livePG/HTTP运行；Averroes不同freshRisk2独立static/offline，noDB/HTTPuntilexplicitgrant。14source/test/.next冻结；七docs待fullterminal/disposal/21manifest；未candidateGO不commit/PR。

- [complete naming ADMISSION; in_progress build] Avicenna6calls/190.85s exact07 80D9...752CF P0/P1/P2=0 ADMISSION GO，只改任务名；原F16A保留。按GO更新精确ee4/runtimehelper，实际四容器receipt记录后e1b03e/78064构建进行；最终lint87763进行。v4 actual519pass+5skipped/15files离线，不称live zero-skip。

- [in_progress corrective ADMISSION] CLI将首次ee48任务名实际归一为ee4，精确owned guard拒绝；仅07命名纠正需fresh Risk2 GO，未业务DB/HTTP/build。原F16A准入/stack-start失败保留，不放宽任意prefix。
- [complete preliminary local gates] v3九文件329/329、tsc及全量lint终态0；v4更广旧UI/配置gate离线终态0，live五项离线skip不当最终验收。

- [complete] PR53 ordinary merge ee48/tree379aff、own/post-main CI2088/11/11及新3013匿名preview闭环。
- [complete] 07 independent fresh Risk2 ADMISSION P0/P1/P2=0 GO/F16A...636F0，两个旧NO-GO不覆盖；范围21/5production/4newtests/5guards/7docs，11markers/12new-only。
- [in_progress] 只读guide、回执解析、两固定入口/五守卫实施。首83green，lint setter修正0；异步卸载fixture80/3保留，当前v3/完整定向待。
- [pending] final tsc/lint/build、exactnewsynthetic stack真实HTTP/PG/fullsuite、Chrome注册→旧MainQuest/技能/活动→guide重访/七宽度/zeroCore读保持。
- [pending] fresh candidate独审/grant/release/disposal/21hashGO、commit/ownCI/不同FINAL/ordinarymerge/postCI、随后新acceptedpreview。
- [pending] 项目真实AI（用户稍后提供）、完整十三步/整站验收；不借mock或公开部署权限。

## 2026-10-09 — 当前手机图谱范围（覆盖后文旧PR52 pending）

- [complete main/independent runtime/disposal; in_progress final candidate binding] Lagrange独立190/React24/helpers64/147+1911/58old/7blobs/9authority/4prod逆向及granted105/SQL8+immutable+strict/0049prosrc/2RLS通过，DIRECT永久DB_ACCESS_COMPLETE；主76355→136a4f精确仅task销毁exit0、6edb4e容器/卷0、dev11/10healthy和clone/预览/备份保持。主2088/105files和browser88+24属主证据。七docs/全19现冻结待独立hash-bound candidate GO，未GO前不commit；04/06/旧failures/source12/.next完全保持。该GO后还必须selected19commit/draftPR/ownCI/不同freshFINAL/ordinarymerge/postCI，不称整站完成。

- [complete main fullsuite; in_progress fresh independent exclusive DB] 4120→33148e full105files2088/2088、零skip/fail/pending/todo/unhandled，02:20:41/541.33s；raw47A247...EDF2C严格重解析。Fresh Lagrange独立offline190/actual攻击暂无finding，现明确独占task54331/54332；主停止DB/HTTP。其targeted/只读8及永久释放后才主精确owned清理、七docs最终冻结与十九manifest candidate GO；未GO前不commit，不以主green替代独审。原source、preview、备份及旧failures保持。

- [complete corrected main narrow gates; in_progress fullsuite/independent candidate] 最新190/190/0skip、newbuild/TS/42pages/7Lq2EG4VC6CsNUhRKCggE、finaltsc/lint0/no-warning、Chrome connected88+geometry24/console0/two-v2图片已验，十表facts/XP/ledger/reward不变。原v1NO-GO/所有首次fixture误判保留；完整liveDB/HTTP4120在跑，四source/八tests/.next冻结，待fresh candidate→独占DBgrant→release/owneddisposal→十九hashbinding，未candidateGO前不commit。

- [complete corrective admission; in_progress corrected tests/build] Mencius06十九路径九markers风险2ADMISSION零findingGO（698EDB...5D88A）后才改两page三处独立键盘nonce与strict successor守卫；新原页回归正确2pass/4red已保留。当前新target/build/lint、原生browser/fullsuite/independent候选尚待，旧v1 NO-GO与全部green作为历史，不是已验收。

- [NO-GO main browser] v1两处class-only164/build/lint/52与24条实际Chrome几何已过，但600244两图Arrow→Tab→返回同目标真实失焦；浏览器已关闭、十表snapshot不变。06补充十九精确路径ADMISSION pending，生产page/旧guard修复必须其fresh Risk2 GO后。历史green不是当前验收，未commit/PR；全站目标active。

- [complete admission only] 新04/十四路径/两生产class-only范围经Harvey独立Risk2 ADMISSION P0/P1/P2=0 GO，controller134E00...56311/basef100/tree4cc70cb绑定，不是候选或merge许可。
- [in_progress] 两处MiniMap hidden md:block与新strict f100/旧累计audit-only适配已实现。基线新8回归4红4通过保留；新targeted/full-liveDB/build/browser/连线与十表前后snapshot及独立Risk2候选均待。
- [pending] 精确候选GO后commit/PR/ownCI/不同fresh FINAL/ordinarymerge/postCI及preview，再新用户MainQuest/技能引导与真实AI十三步。持续整站目标active，AI用户稍后提供，不公开部署，不改源库/旧预览/备份。

## 2026-10-09 纠正门禁（覆盖下方v3状态）

- [complete runtime and disposal; in_progress final binding] 不同fresh Ptolemy completed-build167/167、实际SELECT read-only8/immutable/两RLS通过，直接DB_ACCESS_COMPLETE/全部clients终态；两个外层审查验证错误保留，测试子命令0与最终b567a4 terminal0归属明确。主5177→ca1f0a精确销毁仅本轮合成栈，44f9fc task容器0/卷0、原dev11running/10healthy与恢复副本保持。03/MASTER/全18现冻结待fresh hash-bound candidate verdict；未GO前不commit，不重复运行已销毁栈或复用旧v3绑定。下方pending为时间顺序过程快照，最终状态由本条覆盖。
- [complete main corrected terminal; fresh candidate in_progress] target115、新build/TS/42pages/_nVxKWA83gF6HIOqusLbm/lint、realChrome19原JSON60E520...DDEC/两v4图、真实full102files2024/2024/0skip raw7176...11A2D、显式harness11均terminal0；源码/tests/.next冻结。Ptolemyfresh同Risk2独立115/realReact15/Canvas-store26/守卫96通过、无新finding，独占task167/read-only8进行；主全部clients释放后不DB/HTTP。待直接release→精确仅task清理→全18note/hashbinding零findingGO，不能先commit，旧v3NO-GO/失败制品保持。
- [complete finding/reproduction] FeynmanRisk2 NO-GO P1=2/P2=1，独立111/163/read-only8/107均通过仍真实复现三漏洞；DB_ACCESS_COMPLETE/close。主新增4回归在旧源码27pass/4fail准确复现（cb369a），不是测试fixture误判。
- [in_progress correction validation] 只三生产片段：all-hidden清lastFit、取消两个builtin自动fit、稳定EMPTY_CLUSTERS；临时measurement-null不清，原camera/edge/focus/Controls/业务保持。旧source3/03/NO-GO及runtimeJSON/图保留；target115进行，之后新build/完整suite/browser/同Risk2纠正独审与18-file最终绑定。旧2020/build/browser不证明修正通过。
- [pending] 无新的候选GO前不commit/PR/FINAL/merge/更新preview；task栈保留仅供纠正，原source/3011/3010/备份不动。全站13步/真实AI仍待。

## 当前图谱就绪度修复候选（2026-10-08，覆盖后文旧待办）

- [complete previous milestones] PR50/51已通过独立candidate/FINAL、自身CI、ordinarymerge/post-CI；当前main/base ab84df35319d08247388051c451be523afe3c7a7。source0053单次正式升级/无损后验及3011匿名preview已单独验收；原数据/全部备份与旧3010保持，不能因后文历史pending重复迁移。
- [complete admission] 图谱02精确四UI/18全文件范围SHA7129A840...4489E，Hume独立Risk2 ADMISSION ONLY GO/offline139后才适配限定七markers守卫；旧策略、旧拒绝与受保护blob保持。
- [complete main validation] 实际measured/viewport就绪、ResizeObserver/RAF、Knowledge等价对象memo、Skills剩余高度；v3 lint/TS/42pages/build、harness11、targeted111、真实完整102files2020/2020零skip通过。raw6487FBB8...9476C4与旧失败JSON保留；19条真实browser结果/两手机图片/clip/44px/resize/cold/filter/layout/list/table/zoom/nativeTabEnter通过，MiniMapoverlay与无edge导航证明限度明确，不能冒称手机全部无遮挡。
- [in_progress] Feynman不同fresh Risk2 PRECOMMIT CANDIDATE：独立实际反例/targeted163/read-only8、最后全18文件及note/MASTER/hash绑定；主客户端释放后给独占task54331/54332，无原dev访问。其释放后精确全栈清理，再冻记录；有finding同档修复重新送验。无candidateGO前不commit。
- [pending] 通过后只受托普通commit/draft PR→exact-head ownCI→不同fresh committed-head FINAL→ordinary merge/post-main CI；另行构建/独审更新用户preview。没有admin/force/branch删除/公开部署。
- [pending whole-site active] 04§13全新用户13步、真实项目AI（用户稍后提供配置，不能mock替代）、connected-edge实际浏览器导航/进一步手机可用性与部署边界。Reality0/Artifact认定奖励双延期/八冻结奖励保持；本轮不是整站完成。

以下计划保留为历史投稿状态，其人工merge/旧baseline/pending不得覆盖当前证据。

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **当前里程碑（2026-10-08）**: Phase8F implementation FINAL FROZEN，PR45–49已各自独立FINAL/CI/merge/post-CI闭环；当前五文档归档publication candidate，尚未自身验收/合并。现实成就零积分、Artifact认定与奖励延期；整站交付未完成。
> **当前已验主分支基线 (main)**: `cce3c3480a9912e9ff4aa89e59843af05b9ab961`
> **历史冻结摘要（截至2026-10-03）**: Phase 8C **FINAL FROZEN**；Phase 8D admission 与 Round 1–5 全部通过。Round 5 corrective implementation exact head `8b33cca8e994ba45862194d5588642e9e76626ba` 的 CI Run `36590521018` 双绿，fresh independent Gatekeeper `P0=0 / P1=0 / P2=0 + GO`；PR #37 已由用户合入 `main`（merge `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643`），post-merge main CI Run `36593720889` 双绿。**Phase 8D = FINAL FROZEN**（归档 `docs/Phase8/19_PHASE8D_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`）。
> **Phase 8E 历史快照（2026-10-03；非当前待办）**: Round 5最终 head `ff36ac72d0f0f2c3f58054835e07f5d769740ce7`，CI `37106817366` 全绿，fresh Ampere `P0=0/P1=0/P2=0 + GO`。用户合并 PR #40 为 `b6af5a8`，与 reviewed head 树完全相同，post-merge CI `37109984608` 全部31步骤成功。24号冻结归档记录实施闭环；归档分支自身尚待审查/CI/用户合并，不冒充已经在 main。

## 2026-10-08 — 当前归档计划（优先于所有下方历史快照）

- [complete] 8F准入及Round1–5实施门禁闭环；最后ownCI37726695023/postCI37727725161均31steps、1815、harness11、E2E11通过，fresh Mendel FINAL零finding GO。Round5两次专属栈清理均在独审释放后执行，开发环境保留。
- [complete] 隔离`.data/phase8f-freeze` / `codex/phase8f-final-freeze`，只允许29、MASTER和三计划文档；root dirty/已冻结25–28及Check不改。十次历史CI/head/tree重新验证，归档记录旧NO-GO及证据所有权。
- [in_progress] 五文档自检与独立风险2候选review：范围/链接/hash/完整Git树、奖励8常量和来源谓词、历史与当前状态、实现与归档/部署授权边界。任何finding修复后重新绑定，不带病提交。
- [pending] selected commit/push/draft PR、自身exact-head CI和不同fresh FINAL零findingGO；按用户自PR44起委托ordinary merge，核验整树与post-CI。禁止admin/force/branchdelete/公开部署。
- [pending] 归档发布闭环后单独核验整站交付缺口及可用本地预览；保持现有数据库和未提交工作，不自动实施8G/上线/真实数据迁移。全站目标继续active，无臆测百分比。

下方2026-10-03及更早记录仅保留当时过程，其8E归档/8F准入/auth待办已由当前证据链解决；旧手动merge流程已由用户PR44起的明确委托替代，不是现行阻塞。

## 2026-10-03 持续推进计划（历史快照）

- [complete] 实时复核 Round 2 exact head、PR、CI、WSL PostgreSQL；保留并行 login/auth/package/launcher 改动。
- [complete] Round 3：de08a89 的 CI 37041522823 双绿；Huygens fresh exact-head `P0=0/P1=0/P2=0 + GO`，独立 104/104 无跳过。0048/0049 未改，0050 corrective 接受。
- [complete] Round 4：`/rewards/wishes` 与窄范围导航、交互、无障碍和响应式验证；controller §17 与后端原样。a2614d2 exact-head CI双绿、全新独立GO。
- [complete] Round 5：O001–O005/O019/O020 命名退出测试；完整测试/真实 DB/E2E/harness/lint/build；生产零差异检查、最终独立审查；PR #40已具备用户手动合并条件。
  - [complete] 本地验证与独立候选GO：真实DB全量1331通过/1个既有login失败/0跳过；tsc/lint/harness/build完成，McClintock独立57/57及反例通过（详见23号记录）。
  - [complete] 仅提交本轮9个测试/文档文件 `ff36ac7`；exact-head CI37106817366双绿、全新Ampere最终GO；随后用户已合并。
- [complete] 用户手动 merge PR #40 → post-merge CI `37109984608` → 8E 实施冻结归档；无生产增量。
- [in_progress] `codex/phase8e-final-freeze`：七个状态/计划/归档文档，独立风险2复核 → 文档提交/推送 → exact-head CI与fresh GO → 用户手动合并。未推定归档已发布。
- [pending] 8F 独立 admission：用户于2026-10-03已选择先完成成就记录、现有Core来源防重复奖励和撤销闭环；现实成就只记录不发积分，Artifact继续延后。该决定需写入独立控制文件并接受准入审查，不修改reward-v1。8G可选、部署验收另行授权。
- [pending] 单独核查并行登录改动的遗留测试失败；不要把别人的未提交工作混入奖励阶段提交。
- [complete] Round 3 corrective local gate：0050 规范化/CHECK/唯一索引/历史拒绝 guard 及大小写 UUID 提案发现修复；Turing fresh candidate Gatekeeper `P0=0/P1=0/P2=0 + GO`（真实 SQL/HTTP 37/37），历史 0048/0049 不变。随后 exact-head CI/Huygens GO 已完成，见上方记录。
- 全站完成按功能与部署验收项计，不使用无工作量分母的百分比。不可越过人工 merge、未决规则或必要托管授权。

---

## 阶段总览与状态

- [complete] **Stage 0–4: 业务基础与核心领域模型** (已全部 FINAL FROZEN)
  - 基础设施、活动记录、两阶段确认流、确定性增长引擎、任务系统
- [complete] **Stage 5–7: 领域高级模型与能力建设** (已全部 FINAL FROZEN)
  - Stage 5: 技能树领域服务与 API 契约
  - Stage 6: 知识图谱领域服务与 API 契约
  - Stage 7A/7B: 产物权威定义（Durable Work Product）与链接关系
- [complete] **Phase 1–4: 新中式水墨视觉体系现代化基石** (已全部 FINAL FROZEN)
  - Phase 1: 设计 Tokens (`design-tokens.css`)
  - Phase 2: 全局 AppShell (`AppHeader`, `AppSidebar`, 响应式)
  - Phase 3: 共享 UI 基元库 (`LevelBadge`, `MasteryBadge`, `XPProgress`, `BaseModal` 等)
  - Phase 4: 成果库 UI 现代化 (`/artifacts`, `InspectorDrawer` 集成)
- [complete] **Phase 5: 核心业务页面现代化** (已全部 FINAL FROZEN)
  - [complete] Stage 5A-UI: Dashboard 个人仪表盘视觉重构 (PR #18 已合入) ✅ FINAL FROZEN
  - [complete] Stage 5B-UI: Quests 任务系统视觉重构与无障碍治理 (PR #19 已合入) ✅ FINAL FROZEN
  - [complete] Stage 5C-UI: Skills 技能树与 ReactFlow 画布现代化 (PR #20 已合入) ✅ FINAL FROZEN
- [complete] **独立审查与核心引擎加固 (2026-09-05 & 2026-09-06 Review & Re-Review)**
  - [complete] P1-01: 修复掌握度提议跨技能/知识误升级 bug
  - [complete] P1-A: 修复新技能空 UUID 传入计数查询阻断结算
  - [complete] P1-B: 修复生产模式未配置 AI 时的 mock 泄露问题
  - [complete] P2-01: 修复 30 天重复计数受 1000 行限制截断问题
  - [complete] P2-A: 修复测试 any 类型与未使用变量，ESLint 全绿
  - [complete] P2-B: 落地 `docs/MASTER_PROJECT_HANDOFF.md` 权威交接主文档
  - [complete] R1: 门禁测试引入 `AUTHORIZED_CORE_BUGFIX_ALLOWLIST` 精确手术式白名单
  - [complete] R2: 实现进程内确定性 OpenAI 测试服务（`mock-ai-server.ts`），CI 双绿
  - [complete] R3: 纠正交接文档 Mastery 等级为 M0~M10 与验证门槛
- [complete] **Phase 6: 高级画布现代化 (Knowledge Graph Canvas)** (PR #21 已合入) ✅ FINAL FROZEN
- [complete] **Phase 7: 全站端到端无障碍 (A11y)、响应式与动效收敛** (PR #22, #23, #25, #27, #28 已全部合入) ✅ FINAL FROZEN
  - [complete] Round 1: 无障碍语义、键盘导航与图谱表格替代视图 (PR #22) ✅
  - [complete] Round 2: 全视口响应式压力硬化 (PR #23) ✅
  - [complete] Round 3: 动效降级与全站动效收敛 (PR #25, PR #27) ✅
  - [complete] Round 4: 全页交叉验收、活跃文本对比度合规 (P1-05)、72 格全矩阵运行时证据归档与终局冻结 (PR #28, Merge: `653fe018f6cee38b2263fbcca19dffbf624d4c18`, Exact Head CI `34707377871` success, post-merge push CI `34708617506` failure — KNOWN PUSH-TO-MAIN GOVERNANCE GUARD INCOMPATIBILITY) ✅ FINAL FROZEN
- [complete] **历史 push-to-main 治理缺陷闭环**: Phase 8B 治理加固已覆盖 merge-base delta guard；当前 main push CI Run `35315613393` 的 `check` 与 `supabase-integration` 均 success。Phase 7 历史失败 Run `34708617506` 保留为历史证据。
- [complete] **Phase 8A: Outer Growth Loop 架构冻结与实现授权准备**
- [complete] **Phase 8B: Season & Review 权威实现** ✅ FINAL FROZEN
  - [complete] DB foundation + 9 RPC authority：真实 Supabase CI Run `35119470754` 全绿
  - [complete] API routes / adapters：exact head `6e5ccdfc902dee3d9478742876aaefc0560f7e02`，CI Run `35121618237` 的 `check` 与 `supabase-integration` 全绿
  - [complete] Journey UI：`/journey/seasons` 与 `/journey/reviews` 已实现；Round 4 exact head `6f94f3a06ea30cfb77faa870053aedcbf03f6b8b`，CI Run `35124441177` 双绿
  - [complete] Round 5 exit verification：O006/O013/O014/O015/O016/O022、并发 Review version allocation、Proposal accept/edit/reject CAS 与 concurrent winner/loser 均已纳入；fixture 修复 exact head `80abfa3878a76e1f74279c86d0c5413786fad9e9`，CI Run `35128996512` 的 `check` 与 `supabase-integration` 全绿，真实 database-backed tests、deterministic harness、E2E 均 success
  - [complete] Corrective exact head `ae35a63ab15abab6c6e7fafd06fd51281ab6e634` 已关闭旧 Gatekeeper 的 P1-01/P1-02/P2-01/P2-02；独立复审结果 `P0=0 / P1=0 / P2=0 + GO`，Exact-Head CI Run `35310121814` 全绿
  - [complete] PR #33 已合入 main：merge `0e4bec5f26411669f7031af4523b6d4fca747f96`；post-merge main CI Run `35315613393` 全绿，DoD 最终 merge gate 已满足
- [complete] **Phase 8C: Journal + State** ✅ FINAL FROZEN — PR #35；final reviewed exact head `f2f4d2b2d0a857348b6282dfdbfb3cfd08f4a06d`；Exact-Head CI `35381923343` success；merge `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`；post-merge main CI `35432361509` success
- [complete] **Phase 8D: Strategy + Personal Playbook** ✅ FINAL FROZEN — PR #37 已合入 `main`（merge `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643`，post-merge main CI Run `36593720889` 双绿）；final reviewed implementation exact head `8b33cca8e994ba45862194d5588642e9e76626ba`，Gatekeeper `P0=0 / P1=0 / P2=0 + GO`。
- [complete] **Phase 8E: Reward Economy + Wishes 实施** — FINAL FROZEN；最终 `ff36ac7`、用户 merge `b6af5a8`、post-merge CI `37109984608`；24号归档分支的审查/发布另列，不代表已合并。

### 2026-09-29 — Round 4 Playbook UI

- [complete] 核对控制契约、现有 HTTP 响应、Journey 样式和测试模式；用户批准补充当前用户可见的只读提案/来源投影。
- [complete] 实现 `/journey/playbook` 与 Journey 导航：列表/详情、创建、测试、证据、评估与显式晋升、情境化、退役、版本、知情提案审核。
- [complete] 增加交互回归，执行定向/全量测试、lint、typecheck、build 与差异边界检查。
- [complete] implementation exact head `6fea360adffc4f7d9cde7a159797d246ca55f592` 的 CI Run `36559214448` 双绿，独立只读 Gatekeeper `P0=0 / P1=0 / P2=0 + GO`；PR 保持未合并。
- [pending] Round 5 exit verification（另阶段）；不在本次 Round 4 交付内。

## 2026-09-18 — Phase 8C Journal + State Controlling Document

- [complete] 独立复核冻结的 Phase 8 架构包与当前 Phase 8B FINAL FROZEN 基线。
- [complete] 起草 `docs/Phase8/16_PHASE8C_JOURNAL_STATE_IMPLEMENTATION_CONTROLLING.md`。
- [complete] 文档一致性、编码、diff 与生产目录零改动校验通过。
- [complete] 已提交并推送 `codex/phase8c-controlling-review`，Draft PR #35 已建立。
- [complete] 独立 Gatekeeper 初审 exact head `d83c324b...`：`P0=0 / P1=2 / P2=0 — NO-GO`。
- [complete] 首轮修正 P1-01（authoring context vs FK SET NULL）与 P1-02（JOURNAL_INSIGHT proposal settlement 未授权），corrective head `e40cd4cf...` 已完成独立 exact-head 复审。
- [complete] 该复审结果为 `P0=0 / P1=1 / P2=0 — NO-GO`：P1-02 已关闭；新增 P1-01R 指出父删除后历史 Journal 若在所有 edit 上重跑 context 必填校验，将违反冻结的可编辑/可归档生命周期。
- [complete] 第二轮修正 P1-01R：CREATE 必检；UPDATE 仅在显式变更 `entry_type` / relevant contextual FK 时重检；父删除后普通 content/state/edit/archive 操作继续允许。
- [complete] corrective exact head `a702985041c3fb616ea3b64b5998ffd6de0d087b` 已完成独立 exact-head 复审：`P0=0 / P1=0 / P2=0 + GO`；P1-01R 与 P1-02 均关闭。
- [complete] Round 1：implementation exact head `c9d0d2765a043a4dc874a6c0a1f16da9f29807f8`；GitHub Actions Run `35339072556` 的 `check` 与 `supabase-integration` 均 success，其中真实 Supabase startup、database-backed tests、deterministic Growth Engine harness、E2E 全绿。
- [complete] Round 2：Journal repository/API/domain 与 parent-SET-NULL 兼容边界已实现并通过最终 exact-head 验证；accepted head 为 `8c156032c95caae7b1832ad7dc0d2603d5bb8981`，CI Run `35367209443` 双绿，两次独立复审均为 `P0=0 / P1=0 / P2=0 + GO`。
- [complete] Round 2 首轮 corrective 已关闭 `c74a583...` 的三项 P1；exact head `886761353a0b053e89f1836e26e287a612b0f2fa` 的 CI Run `35363920987` 双绿，后续独立复审确认上述三项均关闭。
- [complete] Round 2 第二轮 corrective：最终 head `8c156032c95caae7b1832ad7dc0d2603d5bb8981` 已关闭该轮唯一 P1，并由 exact-head CI 与两次独立复审确认接受。
- [complete] Round 3：新增 `/journey/journal` 与 Journey “日志”导航；实现反思 create/edit、类型/归档筛选、Quest/Season context、archive/unarchive、7 个主观状态控件、当前筛选集描述性均值，以及 loading/empty/error、Ctrl/⌘+Enter、responsive 与长文本处理。独立复审在 exact head `d217366d4e2e401566446b2bfda0ea5faf46a18d` 发现唯一 P1：父对象合法删除并 `SET NULL` 后，历史 required-context Journal 被 UI `required/disabled` 阻断普通编辑。当前已按 Round 2 规则手术式修复：CREATE 始终校验；UPDATE 仅在显式改 `entryType` 或 resulting type 的 relevant contextual FK 时重检。新定向测试 28/28；全量 `46 files passed / 22 skipped`、`759 passed / 314 skipped`；lint、production build、deterministic 11/11、`git diff --check` 全绿；冻结 Phase8 00–12 与 Round 2 authority 区域零新增差异。
- Phase 8C 实现起始基线为历史 `main` `7df500b1c764efd247938dcf3da4e83b6e2e8e45`；当前权威 `main` 已推进至 merge commit `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`。
- controlling document 规定的 Round 1 → Round 2 → Round 3 → Round 4 已全部完成并通过最终 merge gate；后续不得继续扩展 Phase 8C 冻结范围。

### 2026-09-19 — Phase 8C Round 3 corrective CI governance

- [complete] Round 3 first submitted head `5617b5c8383f675cde4c041ba8c4b0f0362810da` exposed a historical visual-governance false positive in CI Run `35374173512`: the mixed Phase 8C PR was classified as a visual migration and the already-authorized Journal API/migration files were rejected by the stale guard.
- [complete] `tests/visual-foundation.test.ts` now binds the Phase 8C controlling document to exactly three accepted Round 2 backend paths; unknown backend remains fail-closed, and the same backend remains unauthorized when the controlling document is absent.
- [complete] Local corrective gates: governance regression `111/111`; Round 3 targeted regression `138/138`; full test `758 passed / 314 skipped`; lint, production build, deterministic harness `11/11`, and `git diff --check` all pass. Frozen Phase8 00–12 and Round 2 production authority areas have zero new diff.
- [complete] Corrective exact head `d217366d4e2e401566446b2bfda0ea5faf46a18d` 的 GitHub CI Run `35375469477` 已双 job 全绿；随后独立复审返回 `P0=0 / P1=1 / P2=0 + NO-GO`，唯一 finding 是历史 required-context Journal 在父删除 `SET NULL` 后被前端表单门禁阻断普通编辑。
- [complete] 该 P1 已本地关闭：表单仅在 CREATE、`entryType` 改变或 resulting type 的 relevant contextual FK 被显式改变时恢复严格 context 校验；历史 NULL 上下文普通正文/状态编辑可提交，PATCH 不补造 `questId/seasonId`。新增运行时回归验证此行为；targeted `28/28`、full `759 passed / 314 skipped`、lint/build/deterministic `11/11`、diff-check 全绿。
- [complete] Round 3 P1 corrective 已进入后续全基线 Gatekeeper；历史 parent-deletion NULL-context 编辑 finding 已关闭，后续终审仅剩 Round 4 context-filter P2。

### 2026-09-19 — Phase 8C Round 4 exit verification

- [complete] Final Gatekeeper reviewed full baseline 7df500b1c764efd247938dcf3da4e83b6e2e8e45...adc4042fc3846d133d23cbe03fd5e24342c3c067 and returned P0=0 / P1=0 / P2=1 + NO-GO; the only finding was missing Journal context-filter UI required by §5.5.
- [complete] Minimal corrective implementation adds Season and Quest context filters to /journey/journal, using the existing HTTP API seasonId / questId query contract only; no backend/domain authority changed.
- [complete] Regression test now verifies Season and Quest filter selections are sent through /api/journal, while prior parent-deletion NULL-context edit coverage remains intact.
- [complete] Local corrective gates: targeted 28/28; full 46 files passed / 22 skipped, 759 passed / 314 skipped; lint, production build, deterministic harness 11/11, and git diff --check pass. Frozen Phase8 docs and accepted Round 2 authority areas have zero new diff.
- [complete] Final corrective exact head `f2f4d2b2d0a857348b6282dfdbfb3cfd08f4a06d` 已通过独立最终 Gatekeeper：`P0=0 / P1=0 / P2=0 + GO`；Exact-Head CI Run `35381923343` 全绿。
- [complete] PR #35 已合入 `main`，merge commit `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`；post-merge main CI Run `35432361509` 的 `check` 与 `supabase-integration` 均 success。
- [complete] Phase 8C 最终归档：`docs/Phase8/17_PHASE8C_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`；状态 **FINAL FROZEN**。Phase 8D 保持 BLOCKED / 未启动。


## 2026-09-19 — Phase 8D Strategy + Personal Playbook

- [complete] Phase 8C 归档 PR #36 已合入 `main`：merge `98dbe37e0a6fe334b6638ca568bc3ba06b4c3aac`；post-merge main CI Run `35436440893` 的 `check` 与 `supabase-integration` 均 success。
- [complete] Phase 8D controlling document 已形成 admission candidate：冻结范围、确定性 confidence/lifecycle 规则、四个 Strategy RPC、source provenance / anti-replay、`STRATEGY_HYPOTHESIS` proposal settlement、Playbook UI、Round 1–5 与 DoD 均已绑定。
- [complete] controlling-document reviewed exact head `b4c26079e5532cc1c02238f70de95f3e4694e554` 已通过独立 Gatekeeper：`P0=0 / P1=0 / P2=0 + GO`。
- [complete] Round 1 — DB foundation：exact head `400cf1536e86412e6183e45289d87cb21bd56ba1`，CI Run `36338180207` 的 check 与 supabase-integration 均 success，真实 database-backed tests 执行成功；fresh independent Gatekeeper 为 `P0=0 / P1=0 / P2=0 + GO`。
- [in_progress] Round 2 — RPC authority：四个 Strategy RPC、确定性评估、审计、反重放、幂等、proposal settlement 与真实 DB 负向测试。
- [pending] Round 2 exact-head CI 与独立 Gatekeeper；通过前不进入 Round 3 server boundary。
- [in_progress] Round 2 CI corrective：`dfdb321` 的 Run `36413584990` 在新增 Strategy DB suite 3 项失败；`43bb67b` 已推送以暴露被测试清理动作遮蔽的原始 SQL 错误，Run `36435042869` 待结果。数据库门禁与独立 Gatekeeper 未通过，Round 3 仍 gated。
- [in_progress] `43bb67b` CI 已确定三处首次 support 调用因测试 `Date` 毫秒截断导致 `SOURCE_TIMESTAMP_MISMATCH`；当前仅修测试为保留 PostgreSQL 微秒的 `created_at::text`，需新 exact-head 数据库 CI 验证。生产 timestamp 权威规则未放宽。
- [complete] `60d463a` exact-head CI Run `36436421919` 双 job 成功；独立 Gatekeeper 仍给 `P0=0 / P1=1 / P2=0 + NO-GO`，P1 是 §10 的真实数据库反例覆盖不足。CI green 不等于 Gatekeeper GO。
- [in_progress] 补充零证据、旧版本排除、租户、UTC 日期、Season/Core link 资格、<60% 弱化和双会话并发数据库测试；本地静态检查通过，真实 DB 运行及新 exact-head Gatekeeper 待验证。Round 3 继续暂停。
- [complete] Round 2 exact head `1910af870fc82ffde35bf76da93d4bac50a5effb`：CI Run `36438563584` 双 job success，Strategy DB suite 12 tests、总计 70 files / 1103 tests passed；独立 Gatekeeper 复核后为 `P0=0 / P1=0 / P2=0 + GO`。原跨表 dedup P1 因与控制文档 §6 明示的 canonical table identity 不符而撤回。PR #37 未合并。
- [in_progress] Round 3 — server boundary：先对齐现有 Outer Loop repository/service/request/http 分层与当前 Next route 约定；仅实现 Strategy 读/写适配和认证路由，四个 mutation 继续委托 0047 RPC，完成本地测试、exact-head CI 与独立 Gatekeeper 前不进入 Round 4 UI。
- [in_progress] Round 3 corrective：`94a1208` 的独立 exact-head Gatekeeper 为 `P0=0 / P1=1 / P2=0 + NO-GO`（真实 HTTP→认证→DB 贯通反例缺失）；已补进既有 E2E suite，待新 SHA 的隔离数据库 CI 与 fresh Gatekeeper。Round 4 继续 gated。
- [in_progress] `fca2842` 的真实 E2E CI 已通过，旧 P1 关闭；独立复审仍有两个测试稳健性 P2。已补测试独立注册与失败后零写入断言，待新 exact-head CI + fresh Gatekeeper；Round 4 不放行。
- [complete] Round 3 implementation exact head `2b0796e66fc900344a1571f39ebd771fe64abe47`：CI Run `36452011311` 双 job success，Strategy RPC 12 tests 与真实 HTTP test 11 非 skipped 通过、71 files / 1118 tests passed；独立最终 Gatekeeper 为 `P0=0 / P1=0 / P2=0 + GO`。PR #37 仍开放未合并。下一阶段为 Round 4 Playbook UI，但本次仅做文档状态同步，未开始 UI。

### 2026-09-29 — Phase 8D Round 5 exit verification

- [complete] Round 5 — exit verification：新增 `tests/phase8d-exit-verification.test.ts`，显式命名控制文档 §10/§11.6 的四个 canonical exit test O008/O009/O017/O021，并补齐 O009 的 Case A（同日聚簇）/ Case B（3 日期 MODERATE 边界）反例；未改 production/迁移。
- [complete] §10 反例与安全项逐条核对：全部条目均有具名测试覆盖（DB foundation、RPC authority、API adapters、discovery API、Playbook UI、真实 HTTP E2E）。
- [complete] 首轮独立对抗复审 `P0=0 / P1=4 / P2=6 + NO-GO` 的四项 P1 已修复：后台 `confirm=false` 非晋升断言、CONTEXTUAL 生命周期、RETIRED 历史可查询、CI-only 策略提案并发 CAS；并收敛 P2（精确 `42501` 断言、VERY_HIGH、ratio=0.75 边界、CORE_EVIDENCE_REFERENCE 零 Core link）。
- [complete] 最终 Gatekeeper 对 `3c09f8a` 的 `P2=3 + NO-GO` 已在 corrective head `8b33cca` 关闭：anon/service_role 不能提交 Strategy 真值、`supporting_activity_ids` 不物化 support、§5.1 canonical timestamp 前提、ratio 0.65/0.85 精确门槛、CONTEXTUAL confirm 仅 transition-only 契约。
- [complete] 本机真实 DB 证据：0043–0047 已增量应用到本机 Supabase dev DB（应用前 `pg_dump` 备份 `.data/phase8d-pre-0043.dump`）；exit set 无 CI `10 passed / 1 skipped`、`CI=true` `11 passed / 0 skipped`；定向 Phase 8D `69 passed / 2 skipped`；全量在 `CI=true` 且设置 Supabase key 变量时 `1151 passed / 1 failed / 0 skipped`（唯一失败为 `stage5b-db-repository` 用例 1 与本机既有 `demo_player@growth-rpg.dev` 的硬编码 domain UUID 冲突，CI 全新库不触发）；仅设 `XP_RPG_TEST_DB_URL` 时为 `1121 passed / 1 failed / 30 skipped`、3 文件失败，多出的 2 个为 stage7d 缺 key 的环境性失败。
- [complete] 本机门禁：ESLint 全量 0 error、`tsc --noEmit` 0 error、`next build` 成功、deterministic harness `11/11`、`git diff --check` 通过；测试残留已清理，scratch DB 已 drop。
- [complete] exact-head CI：`3c09f8a` Run `36587173704`、`8b33cca` Run `36590521018` 均双 job success（真实 DB tests、deterministic harness、E2E）；fresh independent Gatekeeper 对 `8b33cca` 为 `P0=0 / P1=0 / P2=0 + GO`。Round 5 接受，DoD 7/8/9 满足。
- [complete] PR #37 已由用户手动合入 `main`：merge commit `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643`（parents `98dbe37e` + `f5dd59d`）；post-merge main CI Run `36593720889` 的 `check` 与 `supabase-integration` 均 success。最终归档 `docs/Phase8/19_PHASE8D_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`，Phase 8D = **FINAL FROZEN**（DoD 1–11 全部满足）。
- [complete] PR #38（归档+状态同步）已合入 `main`：merge commit `a1da765e492b8d93e6350ac32865d8e0018faa91`；pr head `597e3f8` 的 CI Run `36596794622` 双 job success，fresh 第三 Gatekeeper `P0=0 / P1=0 / P2=0 + GO`。
- [complete] 8B 式独立审查落盘补齐：`docs/Phase8/20_PHASE8D_INDEPENDENT_REVIEW_RECORD.md`，记录三个独立审查实例、四类 P1 与六类 P2 的开启与关闭证据、可复现 CI/test 证据，以及"判决属 attestation"的边界声明。
- [pending] 可选 backlog（需迁移才能改，非门禁项）：已合格 CONTEXTUAL 上 `rpc_evaluate_strategy_status(confirm=true)` 的错误码命名 `INSUFFICIENT_SUPPORT_FOR_PROMOTION` 不够精确。

### Phase 8D Errors Encountered

- 2026-09-19：一条组合式 `rg --files` + 多文件 `rg -n` 只读命令被 Codex 工具安全检查在执行前拦截；仓库零改动。后续改用拆分、窄范围只读查询，不重复该调用。

- 2026-09-19：第二条跨两个文档的复合范围读取同样被工具安全检查在执行前拦截；仓库零改动。后续严格改为单文件单命令读取。

- 2026-09-22：一条同时读取 controlling document、0044、0045 与 tests 的组合只读命令再次被 Codex 安全检查拦截；仓库零改动。已改为单文件、窄范围读取，不重复该调用。

- 2026-09-22：尝试读取 `docs/Phase8/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md` 返回 `os error 2`；项目规则中的真实路径是 `docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md`，后续按该路径读取。

- 2026-09-22：按 checkpoint 简写读取 `0045_phase8c_journal_state.sql` 失败；实际迁移文件为 `0045_phase8c_journal_state_foundation.sql`，已通过 `rg --files` 确认，后续使用真实文件名。

- 2026-09-28：`pnpm vitest run ...` 通过当前 Codex fallback pnpm 启动时无法解析工作区 `vitest`（`'vitest' is not recognized`），但 `node_modules/.bin/vitest.cmd` 实际存在；后续使用该工作区二进制执行同一测试，不重复失败入口。

- 2026-09-28：首次新增的 0046 静态“无写权限”断言使用跨分号贪婪范围，误把 `strategies` 的 INSERT grant 与后续 `strategy_versions` SELECT 拼成写授权；已收窄为单条 SQL statement（`[^;]*`）并复跑通过。

- 2026-09-28：本机 `XP_RPG_TEST_DB_URL` 未配置，Docker CLI 存在但 daemon 未运行（`open //./pipe/docker_engine: The system cannot find the file specified`）；Round 1 的 12 个真实 DB 测试仍属未验证，不能进入独立 Gatekeeper 或 Round 2。

## 2026-10-11 最小本人评估上下文新阶段

- [complete] 合同13精确30/all16独立Risk2 ADMISSION 0/0/0 GO。
- [complete] 七production/七newtests/九旧guard/七docs精确30实际写齐；局部七files139、治理623、PG5、真实HTTP13、type/lint/buildv2与一次纯合成真实AI已验。
- [in_progress] 主full-v1 Gitshim误路由tmp夹具事件已HOLD/停ownedrunner/保留recovery ref/狭窄恢复base及index/30raw保持；shim修后显式26Git夹具前后refs/config保持。重跑完整full-v2及恢复后新owner Chrome；独立candidate/永久释放/精确清理/冻结30仍待。
- [pending] selected30commit→ownCI→不同freshFINAL→普通merge/postmain→新accepted preview→只清无引用cache。
- [pending] Edit模式待用户选择；补证/验证与整站验收仍待。原AI已接通；正式环境/3017/根用户文件/原secret/备份/依赖保持。

### 兼容补充后的当前计划（原条目为过程历史）

- [complete] full-v2真实3005pass/11fail定位并保留；15 narrow32/all17获Newton fresh ADMISSION GO，原13冻结。
- [complete] Auth固定安全文字/旧Demo6显式配置两行/32双hash门禁修复；static-v5完整旧八guard和六AI测试逆向保持、type0、定向193/193、completed build-v3/source24/prod20。
- [in_progress] corrected full-v3/lint、新owner browser、Tesla fresh Risk2 candidate指定目标和SQL；所有客户端永久释放后exact-owned disposal/14与32 manifest冻结。
- [pending] selected32commit→own exact-head CI→不同fresh committed FINAL/新owned栈释放清理→受托普通merge/postmain→新预览独审→仅无引用cache。Edit等既定产品缺口仍未完成。

- [complete 更新] corrected full-v3 actual126files3070/3070、type/lint/buildv3、单独Growth/E2E22、fresh Chrome四宽12几何/8原生Tab/26API/pageerror0、35表readback/singleXP11/两端511-level4-M3保持全部实际通过。main客户端已关闭/census空并direct grant Tesla独占目标157＋SQL8。
- [in_progress 更新] 等Tesla own目标/永久release，随后主owned disposal/14和32manifest冻结/最终独立candidate绑定；当前仍不得commit/push/merge。

- [complete 最终冻结更新] Tesla own157/157和只读SQL8通过并direct永久释放；主精确owned4容器/1卷已销毁、task0/0/formal11running10healthy/nonTask保持，disposal355ADB...ABC2C。原13/15不改，当前14/全部32准备最终离线绑定。
- [in_progress 最终冻结更新] 等exact32独立candidate GO，随后才selected32 commit/ownCI/不同freshFINAL/普通merge/postmain/newpreview/无引用cache；未发布，不称整站完成。

- [complete 历史后续] PR58/accepted52ba/3018已完成，root本地handoff与CI/FINAL保存记录为依据，旧过程日志保持。
- [complete evidence16纠正ADMISSION] Euclid0/0/0 GO仅F4D...冻结合同；原NO-GO两P2保留。accepted52ba/tree f0c2d，EXACT35/all19。
- [in_progress evidence实现] 纯验证/实际SDK/API/UI四files155通过，原UI夹具1失败与headers type失败保留在17；旧闭包/0054/realHTTP/全套/独审/清理冻结尚待，不预签candidate或整站完成。3018与正式DB/root用户数据保护。


## 当前后续 — FACT-EDIT18 完整验收

- [in_progress] EXACT52/MARKERS35治理主回归941与原定向461终态通过；旧helper/932matcher参数/七source逆向保持，完整独立验收尚待。
- [pending] 新完整build与隔离PG/Auth/HTTP受控合成AI、并发/populated全表基线、主full/Growth/E2E/type/lint/四宽Chrome。
- [pending] fresh Risk2候选与不同fresh committedFINAL、精确owned清理、合并及post-mainCI。
- [pending] 正式0055当前批准/新备份恢复/迁移独审、新本机预览；之后Verifier/附件/最新13步整站验收。

既有3019、正式0054、备份、共享deps与root用户修改保留；不将阶段通过冒称整站完成。

## FACT-EDIT corrective当前 — 独立准入后严格53

- [complete admission only] 用户授权唯一新增tests/assessment-context-api.test.ts，只增加类型和false mock；19唯一修订块绑定原18/base/tree，Herschel narrow Risk2 ADMISSION GO。严格53/35/两增加逆向/旧assertions完整，不修改冻结18或缺port生产failclosed。
- [complete main targeted] 实际Provider+DashboardPage复现刷新503卸载回执P1，Pending自有15s owned GET成功才setDashboard、取消跟随Editor生命周期；外部内存store不可变snapshot关闭production React lint。最终主v14 8files464/464、TS0/六文件lint0；治理v3 12files942/942主终态0。
- [pending] 修后build-v3/主full零skip/四宽Chrome真实全流程/独占独审/永久release/精确owned disposal与最终53冻结。v1/v2 full与旧build/失败浏览器全部历史保留19，不能提前commit或正式0055。

## FACT-EDIT final corrective snapshot（本节优先于上方历史pending）

- [complete main] build-v3 WQPlTjOYzDkMzQHrmSS_a/source347、full143files4011/4011零skip/unhandled/child0、TS0/全项目ESLint0warnings0、Growth11/E2E11、治理942/966旧matcher；主Chrome51/8geometry/4Tab/25HTTP与实际GrowthXP12/三owner38表parity。
- [complete independent execution, not candidate verdict] Herschel独立12files246/246与readonlySQL243/19prosrc/RLS/奖励8报告通过，直接永久DB释放，客户端终态与census空。其stdout哈希及三SQL fixture错误准确保留19，不冒称其第二全套/浏览器。
- [complete exact-owned cleanup] 原4容器/1卷→0，其他容器inventory保持，删121623728byte构建cache，source/build/备份/共享deps/正式数据保留。disposal2529CFEF...DD113。
- [pending narrow next gate] 冻结严格53/note与七旧docs完整prefix，Herschel最终离线候选裁决；其GO前不commit。之后selected53/ownCI/不同fresh committedFINAL/普通merge/postmainCI。
- [pending separate authority] 正式0055当前批准、新备份恢复/迁移独审、新本机预览；真实AI/Verifier/附件/整站13步仍不由本切片证明。现有3019及正式0054保持。

# Daily / Weekly Review 当前执行计划

1准入已GO；2实现只读Daily/Weekly/AI/采用草稿；3新tests+旧治理真实历史投影；4定向/完整/真实DBHTTP/providerChrome/lint/type/build；5freshRisk2 candidate→selected42commit→ownCI→不同FINAL→ordinarymerge/postCI；6更新本机preview/启动器，独立验收并精确清理。正式0056与备份/共享deps/用户dirty受保护，整体goalactive。

## Review corrective v7 当前接点（上方阶段pending为历史）

- [complete main only] 六新离线140/140、治理145/145、两旧兼容235/235、四旧真实HTTP92/92、Growth11；build-v7 fpA8GcBivVaprg06FAgp4、type-v5/lint-v6 child0。v6前半段构建与完整中断均不是当前最终验收。
- [complete main browser] Chrome-v14新构建Daily/Weekly真实deepseek-flash两明确调用、十一主题、采用只开草稿、三宽18控件44px/10Tab、零错误；静态47files/2private值零命中，39业务表除旧明确保存的Review/audit外不变，三XP500。模板/注入脚本分别hash绑定。
- [in progress independent] fresh Locke原四P2已独立反例复核；主另复现英文残余allocateXP等，v7修复与六反例后待同Risk2新复核。完整whole-v5在修前精确取消143/零owned残留。双方主客户端终态后已明确独占DB grant，让独审115/readonlySQL先执行，永久release后主才最终wholefull-v6。顺序改变不降低任何终态门禁。
- [pending] wholefull零skip/原30s断言、双方永久release与精确owned清理、七docs和42manifest、candidateGO→selected42/ownCI→不同freshFINAL→普通合并/postCI→新本机preview与启动器窄独审；以上未完成前不签整站完成。


## Review v10 最新接点（此前记录为历史）

当前production/tests已绑定build-v10 `30T31mcIXH3NDul4_SOKP`，主六文件165/165、零skip/unhandled、child0，含8,100个XP大小写/Unicode空白/格式字符组合断言；type-v7/lint-v8均actualchild0。主Chrome-v16五组通过，Daily/Weekly各一次明确调用真实deepseek-flash，上游stop/615及621tokens、无reasoning，应用200/schema/reference有效；采用仅草稿、390/760/1280三宽18控件44px、10原生Tab、零页面错误。47静态文件两不同private值零命中，root.env.local不变；真实39表仅旧明确保存导致review/audit差异，Skill/Player/ledger均500。Chrome已关闭，serve-v10精确TERM143、source-after保持，pre-full-v10实际candidateClients=[]。

Goodall v9独立真实115及SQL已执行并于05:43:35Z永久释放，此后无DB/HTTP重授；其v9发现大写X空白P漏检，旧432组合中324绕过，不把旧执行冒称v10。主v10仅修正action词元统一大小写连接及保留six people/fix problems等明确自然词边界，追加矩阵且保留旧全部断言；同Risk2只读纠正与最终42绑定仍待。最终main wholefull-v6现已启动、独占执行，尚无终态，不预写全套/候选GO/清理成功。第一次收尾WSL shell PATH未加引号导致括号语法错误，browser关闭成功但后续命令零执行；改直接exec后真实静态扫描/39表核验/精确停serve均成功，属于主工具错误。

正式0056不重复、699/3021仍旧正式入口，备份/共享deps/root四保护与旧冻结53/46保持。后续完整零skip→精准合成栈及再生缓存清理→七文档/42manifest→candidateGO→selected42commit/ownCI→不同fresh committedFINAL当前真实运行→普通merge/postCI→新本机入口及最终本地需求审计；不签整站完成，不增加公网或Monthly要求。


## Whole-v7真实失败及只读Git运行器纠正（当前）

wholefull-v7实际159文件/4678断言，4677pass/1fail/0skip/0unhandled，child1/null/null；唯一失败是原assessment-context-governance第135行十内容路径测试自有30000ms超时，实测36230.99ms，不是断言内容不符，不算全套通过。原30s与全部旧断言/新helper/当前production/tests均不改。
主单用例诊断profile-target与v2均同样超时（仅该用例选择，其余156非选择skip不是全套证据）；首个NODE_OPTIONS观测hook未进入worker，没生成Git统计，改为主诊断setup后实测594次真实Git调用共36801.97ms，三命令类别/原始输出不改。一次只读统计Node表达式多括号报错已纠正；首次benchmark把execFileSync含空格单参数误当shell文本导致Gitshow路径错误，未产生结果回执，改实际参数数组后44unique×3对照逐字节相同。
Git安装的cmd/git.exe是46480B启动器，mingw64/bin/git.exe为4422544B实际core；直接core的原594调用预测30.90s，进一步两环境真实对照决定仅rev-parse/show走原生Linux明确同git-dir/work-tree/-C，其余走Windows同安装core，预测27.24s。只改ignored git-bin/git执行后端，原参数拒绝/安全白名单及tmp独立fallback逐字保留；每次都是真实Git，无结果/refs/当前授权缓存，无新服务/镜像/依赖/全局配置。新unit-v15整份旧157仍在跑，未预写通过；若通过才whole-v8重新零skip，不把v7的4677与局部绿拼成完整绿。
Goodall已经报告own v10六165/165、432反例旧324/新0和28正例；逆向v9两完整SHA保留独审history。原20份中18份保持（不是19），helper＋13旧tests14份不变。其115/SQL为v9历史，05:43:35Z/chunk5b22ff永久释放；原逐字全文当前不可恢复，只保留实际marker/time/tool/census，绝不伪造messageID/正文。仍待最终42/全套/精准清理，尚无candidateGO/提交/新PR。
只准备了ignored selected42 commit/fresh FINAL config/只读dispatcher/精准disposer，未执行提交或第二栈启动；新FINALdisposer初稿括号syntaxcheck失败，修后--check0、从未执行删除。进程census补充实际exe识别Node显示MainThread，避免只看comm漏查；正式0056/3021/所有备份/共享deps/root四保护保持。

## Daily/Weekly Review 主验收收口（2026-10-12）

完整whole-v8已actualchild0/null/null：159文件4678/4678、零skip/fail/unhandled；旧30s用例28771.93ms通过，原断言/时限不改。raw SHA256 1B8F5FC5C0A78DE00465CC2CA31AAC2A1D7E0EF05C0670D68863B15EBC4FFCC1，terminal B934CD60FB945A296655BA7EDA24670A76FF28B64C961F3D37AC15B1886A3F5B。主Chrome-v16/current build-v10及Goodall own v10六165纠正证据保留，独审v9 runtime115/SQL不冒称新v10执行。

主精准清理回执207230D66ABFECE52171CE34E3344402EF0571EA4F8A17BE003DE461C247D6AA：原专属4容器/1卷→0，当前可再生cache90files/136927810逻辑bytes已删除，其他inventory/source368/BUILD_ID不变；不是Docker VHD物理空间保证。正式0056/备份/699入口3021/root四/共享deps/旧冻结保留。22不改，七audit更新后freeze42；尚待Goodall最终42 candidateGO，不提前提交/推送/merge或整站完成。随后仍须不同fresh committed FINAL+ownCI+新栈精准清理、普通merge/postCI及新正式本机入口。此前NO-GO/超时/工具失败历史保持，详见23最新段。

## 同Risk2审计P2纠正（保留旧错误历史，待复绑）

Goodall最终offline binding对上一清单90C0C653EF3F607382A6E6D4BDAAE66F4E60147737292FB375E60D338E40BC41签P0=0/P1=0/P2=1 NO-GO：历史将v9大小写行为写反，不能提交。此前“只对小写x+空白+p生效”和“大写X空白P漏检”是主记录错误，现明确撤回其事实效力但保留原错误文字。独审已完成的实际重建v9匹配规则是 `/X\p{White_Space}+P/gu`（区分大小写、没有i）；完整源表达式格式未恢复，不补造逐字源码。其已执行代表输入 `allocateX PAfter testing` 拒绝；`allocatex pafter testing`、`allocatex PAfter testing`、`allocateX pAfter testing` 均接受而违规绕过。432已执行组合中v9接受324/拒绝108，当前v10拒绝全部432，结论限定原矩阵，不泛化任意输入。

本次只向七audit文档和root三计划追加准确更正，production/tests/source368/BUILD_ID/full-v8/browser-v16/disposal均不变，不以修改文档为由伪称重新执行测试。旧NO-GO清单保留为candidate-manifest-v1-no-go.json，新42需重新hash并由同一Risk2仅离线复绑，当前仍未candidateGO/commit/PR/merge。其DB/HTTP永久释放继续有效。首次通知reviewer工具误传id而非target，解析拒绝、未送达；改正确target才实际送达，属主调用错误，不是产品finding。


## 2026-10-22 任务优先的首页流程

目标：解决功能入口并列、日常使用顺序不清晰的问题。基线为当前已交付6dfa8802，独立副本开发，原站点/数据/根目录用户修改保留。
步骤：梳理实际入口（完成）→任务优先UI候选（完成）→相关测试/样式/Turbopack类型构建与浏览器核验（完成：47+119、lint0、三宽交互）→独立核验、CI及按证据交付清理（待）。范围与验收见 docs/SiteReadiness/29_TASK_FIRST_USER_FLOW.md。


## 多文件夹资料连接（2026-10-23）
用户要求：同时连接多个本地文件夹并读取文件。计划：1客户端多连接/旧句柄迁移/来源隔离；2保留单目录/文档/OCR/确认逻辑回归，新增多目录与IDB检查；3真实Windows Chrome隔离虚构目录与移动端；4固定候选独立有界复验和完整CI；5普通合并/postCI/原桌面入口更新及精确清理。正式数据/密钥/原文件不写，AI/数据库/XP规则不改，临时文件放D盘scratch。
