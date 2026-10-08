# 整站就绪度补充：零XP手动技能建档

状态：CORRECTIVE ADMISSION CANDIDATE；旧准入807935FE...BF165仅为历史。已实施首版，真实DB发现权限事实不匹配，当前未通过实现/修正准入，不是上线/数据库升级授权。
基线：a616c28f74d4468ce437b038939979f630c23ae6。
用户于2026-10-08明确批准“新增零 XP 手动技能建档”。本补充属于09的L1产品入口变更，不改变L0 Growth Constitution、确定性引擎或奖励政策。

## 1. 原因与文档优先级

04§13要求注册→Main Quest→建立Molecular Ecology技能→记录行为。Stage5旧authority/API/UI只支持结算时创建技能，因此真实新用户在第3步没有入口。本次明确新增受控创建例外，不能通过伪造assessment、service-role直插或重排验收来掩盖问题。
02新增产品规则和Stage5 authority的日期补充引用本契约；旧Stage5结算、metadata、edges、RLS和派生状态保持。8F/8E冻结常量及Artifact延期决定保持。

## 2. Scope In / Out

In：追加0053专用RPC、严格POST /api/skills、请求认证的独立创建adapter、技能页建档表单、最小产品/authority/MASTER更新及对应测试。
Out：旧0001–0052 SQL、XP/Mastery算法、AI/prompts/config、评估/结算流程、domains创建/新边类型、奖励/audit/账户修改、依赖/锁文件/工作流变更、8G、公开部署、现有开发库迁移。唯一既有表权限收紧限public.skills的anon/authenticated（详§4），不更改service_role或其他表权限。
生产修改仅：新0053；新src/lib/skills/bootstrap.ts、bootstrap-request.ts；现有api/skills/route.ts的新增POST（GET不改）；新skills/components/SkillCreateForm.tsx和page.tsx入口；本契约、02产品设计日期补充、Stage5 authority日期补充、MASTER；tests/supabase-schema.test.ts只加一行迁移清单及新增bootstrap tests。必要generated Database function declaration只能添加新签名，不重生成旧内容。

治理测试适配仅tests/helpers/governance-delta.ts、tests/phase5-skills-ui.test.tsx、tests/visual-foundation.test.ts及tests/phase8f-ui-governance.test.ts：旧PHASE5_SKILLS_POLICY、旧visual验证器的历史分支及8F violations历史函数/所有既有合成断言继续保留。同一完整delta必须同时包含本控制文档、新0053、新SkillCreateForm和skills/page才进入本次分支；精确生产白名单仅新0053、api/skills/route.ts、skills/page.tsx、skills/components/SkillCreateForm.tsx、lib/skills/bootstrap.ts、lib/skills/bootstrap-request.ts六条路径。skills scoped策略仅允许其中API和SQL两条backend例外，不放行整个目录；visual分支不继承历史core/phase例外，不允许混入其它生产/public/配置/依赖/工作流。8F实际跨阶段累计delta仅在完整绑定下免除这六条新路径，其余仍由原violations裁决，旧8F受保护blob原样比对不删。新增缺少任一准入标识及混入旧迁移/其他API/成长引擎/依赖等拒绝回归，既有合成mixed-delta断言原样保留。若无需generated类型则不修改该文件，不将潜在许可写成已发生变更。

## 3. 固定创建结果

- 请求只接受JSON对象 `{ "name": "Molecular Ecology" }`，不接受额外字段。没有userId/id/domain/description/XP/level/Mastery/confidence/verified/status入口；本轮创建未分类技能，可沿既有metadata流程另行编辑。
- name必须string，按ECMAScript trim去首尾空白，长度1–200 Unicode codepoints；200是本次本地输入上限，不是能力/奖励阈值。空白、NUL、孤立surrogate非法；TS与SQL逐项一致。
- 0053复用0052的私有immutable phase8f_trim_text以保持既有25种trim codepoints；身份唯一性仍由0019 skills_normalize_name及(user_id,normalized_name)约束决定，不另发明alias身份。
- UUID由数据库默认生成，永久身份不是name。user_id仅由auth.uid()决定；domain_id=null、aliases={}、description=null、status=active、last_used_at=null、XP=0、level=1、mastery_level=0、mastery_confidence=0。禁止依赖0004的M1/0.5默认值。
- 不创建/更新Activity、Assessment、Evidence、XP ledger、Mastery event/verification、player_state、reward账户/账本/审计等其他表；既有技能和所有既有业务数据不变。
- 同账户normalized_name已存在（含archived/高XP技能）返回SKILL_ALREADY_EXISTS，不重置/复活/返回其内容；不同账户可以同名。并发由唯一约束裁决，最多成功一次，无upsert/update。
- 此RPC是单次create而非审计型可重放结算。网络不确定时不自动重试、不声称成功；保留名称并提示先刷新列表，重复提交只会冲突且不会再创建/成长。

## 4. 权限与服务端

- SQL签名 rpc_create_skill_zero_xp(p_input jsonb) RETURNS public.skills，SECURITY DEFINER，owner postgres，search_path=public,pg_temp；全称表/函数引用。
- EXECUTE仅authenticated；撤销PUBLIC/anon/service_role。新增0053同时REVOKE ALL ON public.skills FROM anon,authenticated并只GRANT SELECT给authenticated，保证匿名无table权限、已登录仅可读取；不更改service_role、其他表ACL、skills RLS/policies/triggers或其他函数权限。旧结算和metadata仍由既有SECURITY DEFINER入口写入，不需要客户端table写权限。
- 依据：17:25真实隔离库relacl显示anon=arwdDxtm/authenticated=ardDxtm，RLS=true且仅skills_select SELECT policy；0028曾grant四DML，而0037仅revoke UPDATE。旧文档“直接权限已撤销”不等于真实ACL事实。首版测试23/25通过、ACL假设及预期拒绝消息两项失败；直接INSERT实测42501 row-level security拒绝，未发现本次创建入口漏授权。修正选择明确收紧skills全部匿名/已登录写能力（包括TRUNCATE/TRIGGER），不以当前RLS拒绝放宽规格。
- 函数内部同时要求current_setting('role',true)='authenticated'及auth.uid非空；匿名/service_role/postgres角色即使误授EXECUTE、伪造JWT role/authority GUC也拒绝。正常PostgREST authenticated请求及测试postgres-origin SET ROLE authenticated允许。authenticator有SET ROLE能力是可信认证边界，不声称抵御超管/伪造数据库级session身份。
- SQL独立验证JSON类型/精确唯一name键/字符串/长度；从未接受客户端成长值或租户参数；权限检查在任何输入验证/写入之前。
- adapter每请求getSupabaseServerClient→auth.getUser确认身份；不得使用admin client/共享缓存/直接insert/Demo回退。发送原生RPC单一tuple，映射现有SkillState。
- POST在解析之前认证；401未登录，400非法JSON/字段/名称，409规范名称冲突；未知SQL/infra错误500仅固定安全信息，不能返回原始私有详情。所有POST JSON带Cache-Control: private, no-store。
- 成功201 `{skill: SkillState}`；响应必须验证租户及固定零状态，缺行/畸形回执不得报成功。

## 5. UI

- /skills在成功加载图谱后显示“新建技能”，空态说明可先建目录，也可通过确认真实评估建立。保留旧图谱/表格、搜索、键盘/Inspector行为；已有节点时同样可建。
- 原生具label的单字段表单、零XP/M0说明、提交中禁用防双击、取消、role=alert错误、role=status确认。仅发送name；不展示编辑成长值。
- 401跳/login；400/409保留输入并提示；不确定错误明确“先刷新列表确认，再重试”；关闭或请求中取消避免迟到响应污染新表单。成功只接受匹配当前请求的固定零状态回执，不采纳不同技能/成长回执。
- 成功后重新读取图谱，清理旧筛选避免新节点被搜索/领域过滤隐藏；图谱刷新失败不能反转已经成功的持久化，应明确重载而不是再次创建。
- 手机可滚动、无横向溢出、触控/焦点/提交反馈满足现有07；不加入新modal/依赖或raw z-index。

## 6. 验收承重命题（风险2）

1. 创建只增一条当前租户零状态技能。填充双方旧Skill/XP/Evidence/Player/账户等基线，逐表快照不变（skills仅允许精确一条新增）；非法/重复/伪造路径零写入。
2. 用户A/B同名互不泄露；空/foreignJWT、anon/service_role/postgres＋扩大EXECUTE/伪造authority不得绕过；table直接写仍拒绝。
3. 主键随机UUID、0019规范身份和旧结算保持；并发同名一个成功一个409，不重置已有/归档技能。客户端key大小写/原型字段拒绝、HTTP私密fallback安全。
4. 固定常量只使用初始XP0/Level1/M0/Confidence0及本地name200上限；复核0019名称标准、0052 trim25 codepoints；8冻结奖励[150,100,150,200,200,100,150,250]不改，Reality0与Artifact双延期不变。
5. 真实构建HTTP＋浏览器desktop/mobile验证创建/刷新/重复/登录隔离及空态，无服务端密钥输出；离线route/repository/UI回归及完整旧1815suite、harness11、lint/tsc/build皆通过（最终计数按实测）。

## 7. 门禁顺序与证据

ADMISSION候选文档独立风险2 GO后实施；isolated任务PG/API上运行测试，不在真实开发库试迁移。实现→主测试→独立candidate审查→commit/draft PR→自身exact-head CI→不同fresh FINAL→普通merge→post-main CI；用户从PR44授权代理创建/合并保持。任何候选改动需相应新审查，不拿旧GO绑定新bytes。
现有0052开发库升级另做新的备份/恢复演练和live GO，原0050备份不覆盖新用户/Main Quest；新权限收紧需后验验证旧metadata/结算读取仍可用。没有此步骤不得替换3010为依赖0053的生产预览。
真实AI等待用户提供合法项目配置；本功能通过只解除04§13第3步，整站13步/公开部署不因此完成。

## 8. 当前证据

首版历史准入由Plato绑定807935FE...BF165（44离线断言）；主新增68API/16UI及旧38API/49schema=171离线通过。真实任务库首版23/25，不接受为通过证据；修正准入与后续所有实现/数据库/HTTP/UI完整验收仍待。后续追加证据不得将旧GO/旧通过计数用于修正候选。

17:53范围检查修正候选：首轮100files/1945中1933通过、12个Git路径环境失败（JSON 6D829900...CF4303）；任务进程只读Git wrapper修正后64中63通过，旧8F累计scope拒绝新增六生产路径，属跨阶段治理缺口。当前仅追加上述两个治理测试的精确适配准入，生产实现/0053/旧0001–0052/依赖均不改变；必须先独立CORRECTIVE ADMISSION GO，再修改验证器和重新跑当前候选。49BFAB94...B6042准入和当前build/offline87保留为上一范围历史，不声称新范围已获GO。
