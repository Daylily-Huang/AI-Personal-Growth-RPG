# 17 — 补充材料实现与验收证据

状态：主实现/验收及本轮精确清理已完成；纠正候选复审等待最终35字节绑定，尚无候选/committed FINAL GO，未提交、未创建 PR、未合并、未应用正式数据库。

## 绑定与准入

accepted base/HEAD `52ba1378d355ccab26f12e7fdd3eedb8464deafe`，tree `f0c2d8545af169c2e569e5323d3608065ec8f371`。
冻结16 raw/canonical SHA256 `F4D0B4C787FA4BAC41707387C7320FFD091422F38F75AD35B8A69CDA450EBF6F`。
分支 `codex/site-evidence-submission-20261011`；EXACT35/19 markers。16的“待审”字样是准入前冻结历史，不改合同字节；实际纠正准入结果在本记录。

第一次 Euclid Risk2 ADMISSION P0=0/P1=0/P2=2 NO-GO：内部 request.url origin 误拒真实 Host，及288KiB不足以容纳合法25项转义JSON。原D8D3...47E0和原裁决保留在 ignored evidence-submission-admission-euclid-v1.md。
同档纠正独审 P0=0/P1=0/P2=0 ADMISSION GO仅许可实现。独立48来源、40正文类/最大25项1240144/技能64814 bytes、全部Unicode标量转义边界、35/19/四历史范围/53旧SQL通过；无DB/HTTP/browser/AI或文件写。该GO不是实现验收。主原实际auth/预算模型 e4ee9e 另行标注为合同模型，不替代产品测试。

## 已运行的主证据（非独立实现验收）

- pure-v1：1file63/63，零skip，child0/signalnull；rawSHA DC8D95B95D06563DD132B7F5B230FB12089D120870BF5FC9233A4C629E5D930E。
- offline-v1：3files136/136，零skip，child0；rawSHA CED959BEB046147A6C2984260AA142C43FB6A4654C2E57541D7A12BC711C5BBA。
- UI-v1：17pass/1fail，child1；rawSHA CD42E896CDE7678F3C4366627442C94C7B24BCABA1CD9DF21180B9891E3158BF。夹具错误要求已完成读请求的signal也必须abort；修为已完成请求不算活跃客户端，另加真正pending请求跨Activity必须abort+late response不得显示的用例，保留原失败。
- offline-v2：4files155/155，零skip，child0/signalnull/errornull；rawSHA 0C334A33EC7EED810D33D8BF464A97807DCF208C79D75B4AB268DCA538CDE4B1。仅当时的输入/实际SDK/API/UI字节绑定，不证明后续新治理/SQL/HTTP已通过。
- 初两次typecheck未过：均新API测试headers联合类型，不是运行时产品错误；已改为过滤undefined并构造Headers，最终typecheck仍待重跑，不隐去失败。

共享既有physical依赖，仅建立符号链接，无install。安装Next16.3.1 route/use-client全文已读。一次测试文件名和SQL文件名猜测失败已由实际rg库存纠正，无生产影响。

## 待完成，不作预签

当前35范围/原helper全prefix/原page逆向/全部旧guards及53SQL保护实跑；新0054真实隔离PG权限/并发/分页/删除/增长零差异；completed build真实Auth/HTTP；四宽浏览器/原生Tab/待核实timeline；主完整PG回归/Growth/E2E/type/lint/build；fresh Risk2候选自执行独审；精确owned disposal和35最终manifest；之后selected35提交/ownCI/不同fresh committed FINAL/普通merge/postmain/新本机预览及缓存清理。所有后续生产改动使旧build/full/browser绑定失效。

本次尚未新建测试栈、未DB/HTTP/AI、无BUILD_ID；暂未产生需销毁的容器/卷。现行3018和正式54321不动。正式0054应用另需备份/恢复演练及门禁；整站仍有Edit产品选择、完整Verifier和当前13步最终验收等缺口。Artifact双延期、现实成就零积分、所有成长规则不变。

## 后续实际更新（保留前文历史）

### 最终纠正候选冻结（等待独立最后绑定，不预签GO）

Leibniz fresh Risk2 PHASE-1 direct终态：P0=0/P1=0/P2=1 NO-GO/PENDING，真实可复现证据缺口为16:114要求320/390/768/1440而主v3测360/390/768/1280；原v3证据仍真实但不能关闭契约宽度项。未确认产品源码P0/P1缺陷。独立亲自离线5files257/257＋实际module/UI内存115断言、授权真实authority34/EvidenceHTTP10/旧8FHTTP18=62/62退出0、readonly SQL8/reward-v1 IMMUTABLE/STRICT/7 prosrc/角色RLS、三populatedowner36表深比较通过；主build/full/browser不冒充其执行。该阶段43/52calls，余9供最终离线绑定。direct DB_ACCESS_COMPLETE PERMANENT后独审未再DB/HTTP；main保存其真实release字段，不伪造独审写出的文件。

主仅纠正ignored浏览器证据helper（无35内source/test/SQL变化）：新隔离completed-build server3087501仍仅127.0.0.1:3062/同BUILD9l8oQr59O_o4dqIkTboeI，真实登录后明确展开已有3条材料，不发任何业务POST或AI。geometry-v1八实际行覆盖320/390/768/1440表单/三receipt（完整8011bytes长文均未截断）、44px/无横溢出，nativeTab3/zero pageerror/businessPosts0。raw9BF7C7750ADB0D8F5D6FD25C4379E2929D5B5B7F8F5B9C19BCBB9BF93AC7AABD；四图另存corrective前缀，实际打开320/1440核对，原错误宽度v3保留为历史。主追加三owner36表readback-v2仍全部原记录相同/仅原3E0+3receipt，没有新成长或奖励。

纠正后namedChrome.close0、exact3087501 SIGTERM→Next/HTTP.close→exec90942终态0，PG finally.end0；新main release-v2 census[]，raw278E341F9A89E8C188C87936E10F1237BCC1660F909CF1C26B50A07B8B749B85。旧main release08FC...及首次browser关闭回执保持，不冒用其证明纠正后退出。

主已在direct reviewer永久释放及新main退出后精确处置原creation29A918...46171D绑定的4容器/1卷，exec9974 child0，disposal raw4297495C281E8BCFBB3E1B56917680197D08302ADEE2ADAD84C11F0CBCD05AC1；task0容器/0卷、formal11running10healthy、全部nonTask ID/name/state保持，source28与protected保持、census[]。只丢弃合成immutable夹具；正式数据/3018/备份/共享依赖/源文件/所有历史证据与截图保留。不声称Docker VHD已经物理收缩，不全局prune。候选.next完成构建仍供后续精确head FINAL使用，未删活跃/共享依赖。

最终范围仍EXACT35/all19markers、acceptedbase/HEAD52ba/tree f0c2d，冻结16 SHA F4D0B4C787FA4BAC41707387C7320FFD091422F38F75AD35B8A69CDA450EBF6F不改。全部28 source/test/SQL逐项与completed build-v1相同，only七docs/plans状态按真实终态补充。主full133files3371/3371/rawF8FA72...61756、deterministic11/E2E11、type/lint零warning、Chrome原55＋纠正geometry8均为主执行；独立257/115/62/SQL8区分清楚。下一步仅最后filesystem35manifest/完整17绑定，GO前不commit/push/PR/正式0054。之后仍需selected35/ownCI/不同fresh committed FINAL/普通merge/postmain/新预览与后续精确缓存清理。当前3018不变；Edit选择、完整Verifier/附件/当前整站最终13步等仍未完成，Artifact双延期、现实零积分，不宣布整站完成。

### 浏览器及主客户端实际释放（尚待独立审查/处置）

- 单独真实E2E 1file11/11，child0/signalnull/errornull/verificationErrornull，raw3D4CBB8608E958B45900BB1497FCD9BE7E90D612D6390060EF66CACFA0D05A1B。
- Chrome flow-v3：55 checks、30 actual API requests、8 geometry rows（360/390/768/1280表单及完整8011-byte保存正文）、3原生Tab、3创建回执、pageerror0、真实AI0。实际201响应丢失后同key/tuple200重放且同Core ID，保存后模拟GET503仍保留receipt且刷新不重发POST，真实cookie清空后401无新增；原文逐字/脚本不执行/链接不执行、foreign404无面板、pending读、Skill timeline两关联材料E0未验证、XP500保持。rawF8971B2369301CB95523511D427D2C3D9C84CDAFE57B753193F9133589EA3E12。
- 额外真实三owner×36tenant tables：每位原有XP500/Level4/M8/confirmed assessment/ledger/verified Evidence/domain、Main奖励200/Wish/非空outer metadata；前后全表深比较仅owner1增加3条E0/false/user_submission Core及3最小receipt，所有原记录完全不变。db-proof rawCB4F0717E93B9B75E7EEA92F8BDAA960B4F0DC35DBCBD6C61ACC56438A926808。这是主执行，独审未被冒称自己运行Chrome。
- Playwright技能影响：沿用已安装CLI且不install，用新独立session，真实登录和角色/标签定位；保留output/playwright八图并实际打开360长文、1280长文、390/768表单核对，布局无裁切/覆盖，44px与无横溢出另由真实geometry验证。未创建@playwright/test套件。
- 浏览器v1原生option等待visible失败（option真实存在但原生下拉未展开隐藏），v2旧已登录session被login页重定向导致夹具等待email失败；修测试脚本wait attached/明确仅清此合成session后v3通过。中间PowerShell引号和CLI run-code function shape错误也保留工具历史，均未改产品source/test或制造通过。原失败日志保留。
- main所有测试/Chrome/Next/PG退出：namedCLI close0、exact browser server3053270 SIGTERM后Next.close/terminal0、PG finally.end。census[]及MAIN_CLIENTS_RELEASED原回执raw08FC1839245D5F3C3A78FFCC7CE2ACEDCEDDBBA77CA47B139E0B01D59A21BCF7；已direct独占授权fresh Leibniz执行指定真实DB。此后主不访问DB/HTTP/browser，待其direct permanent release才owned disposal。当前task四容器/一卷未销毁，不能预签清理。
- 主静态公开资源检查39文件，合成server secret/DB URL raw/URL/JSON/base64变体零命中，root四保护文件SHA保持；无rootenv或用户secret文件重读。独立候选GO/committed FINAL/提交/PR/正式0054均未取得。

### 最新终态：完整构建之前

更新：主full-v1已终态exit0，133个实际testResults文件、3371个assertions全部passed，零非passed；success=true、childstatus0/signalnull/errornull、verificationErrornull，rawSHA F8FA72D3A6764283515E5CE6F50652E86ED58C89F7570A8B49A35AFA39761756。源码28项/全部protected文件/Git HEAD/tree/refs/common config前后保持，读取的是实际原durable JSON，不从stdout缺省推定。其内部describe计数不混同133文件。主单独deterministic harness对应原package script growth-engine，1file11/11终态0、无DB/HTTP/AI配置，raw3302DD052D9BA673087EB9F5F0D14025D843BD0D44BBFCD4A19D5401C184BC31。此为主执行，不冒称独审自行复跑整套；浏览器/独立候选尚未通过。

后续实际type/lint再次终态exit0/status0/signalnull/errornull，无warnings。主completed build-v1终态0，BUILD_ID `9l8oQr59O_o4dqIkTboeI`，只用54331合成配置、无AIkey；全部source/test/SQL及protected文件前后保持，旧Context/Reject hash view明确只为同一构建的兼容视图，不是另一次build。真实HTTP-v1六files123/123，child0/signalnull/errornull、verificationErrornull；raw971914D5953EB9BC3BA97E6815631A036D7B7D91DA5DE4EFDE6433EF3AA2CCF5，包含新Evidence与旧Context/Reject/Activity/Skills/8F真实接口。完整full-v1进行，结果尚待终态；browser尚未执行。

- offline-v4：4files155/155，child0，raw133F1293CB2C823E6BECE060978E312A7F4B4C6B99E96F613B1E0789BFEE18AC；修复ref清理warning后lint终态0/零warning。
- offline-v5：4files158/158/零非passed，child0/signalnull/errornull，raw8A4ADFC11FB90414EB1F491986F85389040FCA78F0ED7FA3C549E2FF15385A11。新增未配对charset引号拒绝与未知提交关闭/重开后保留离页技能标签用例；正文和回执仅纯文本。
- authority-v1：32pass/1fail，raw7557582413304B951CDAFD07BF6D0A37EEE87A4D32AF94AA26E12193F8B8859A。TRUNCATE夹具在延迟FK事件尚未完成时先被PG自身拒绝，未到自定义guard；仅用SET CONSTRAINTS ALL IMMEDIATE完成合法事件后再测，原失败保留。
- authority-v2：33/33/零非passed/child0，raw7A782B9C7E595330FF8900439600DBF667A1B7F4385F13E88A038B5B3AD05862。
- authority-v3：34/34/零非passed，child0/signalnull/errornull、verificationErrornull，raw667797C352C030EC269F16EABF0EAAA0B9AD3D4849795329BBF0F356E6539E60。追加RLS隐藏foreign父记录不能绕过receipt删除guard，以及真正并发archiveSkill/deleteSkill/deleteActivity锁等待和提交后历史回放。全表增长/奖励/愿望快照保持；创建仅新增E0正文与最小回执。全部客户端由afterAll关闭、测试进程终态；专属栈仍保留待后续验收。
- 恢复上一工具显示截断后直接读取原durable终态确认v5/v3，不重复运行、不从空输出推定成功。type/lint上次工具输出未恢复，构建前将再次实际检查。未有completed build/真实HTTP/browser/fullsuite/候选GO。

- offline-v3：4files155/155/zero非passed/child0，raw23432E74D1B4B888B9EDAA01EBCA9B3E1A422300B2CBAFCF1712B1E4FCF7A694，包含当前额外重复Evidence ID拒绝断言。
- governance-v1：11files824pass1fail，raw3C04D4491AEC0CE08D289F46901A65B551E7F23FDDBE6E3E8BE1C943FA17B3C4；遗漏旧onboarding actual35→历史7的16优先入口，fail-closed正确失败。仅补该显式入口，旧断言保持。
- governance-v2：11files825/825/zero非passed/child0，raw782242B3C5CE2C273AADB6CDE58A06C212D8DC61039E220BF5955FC8CB98CFDF，覆盖全部35/19范围、历史门禁、旧视觉/Dashboard/schema及53旧SQL保护。不是独立验收。
- 后续typecheck两次终态0；lint终态0但有generation ref清理warning，待修，不称零warning。
- 新专属phase8f_test_ev_20261011已CLI启动并应用合成0054，创建新四ID/Created/项目/workdir/54331+54332记录于ignored evidence-submission-creation.json；authority-v1真实运行中，结果未定。无completed build/browser/完整回归/独审/提交/正式升级，现行3018与root4实检保持。上述“未建栈”是更早快照，不混为当前状态。
