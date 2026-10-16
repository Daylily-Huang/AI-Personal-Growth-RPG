# AI Personal Growth RPG

把现实中的学习、工作、技能训练与作品积累，整理成可追溯的个人成长记录。

**当前定位：个人本机使用的成长网站。核心成长闭环和主要功能已交付，现已增加本地文件夹与AI整理建议。** 网站只监听本机，不部署公网。代码托管在 GitHub，个人笔记、作品、数据库、连接信息和密钥不提交仓库。

## 已实现的主要功能

| 模块 | 当前能力 |
| --- | --- |
| 活动与AI建议 | 原始输入、最小上下文评估、修改事实后重评、拒绝建议、确认后结算 |
| 成长引擎 | 确定性XP计算、重复衰减、经验与掌握度分离、可追溯账本 |
| 技能与知识 | 手动建立零XP技能、技能树、知识图谱、移动端列表及键盘操作 |
| 任务 | 主支线与层级任务、进度聚合、自定义正数百分比增量（支持小数，上限100%） |
| 证据 | 原始活动详情、材料提交、E0待核实状态、独立的掌握度验证边界 |
| 作品与里程碑 | 作品库、关系链接、手动验收、现实里程碑、愿望积分与心愿流程 |
| 成长复盘 | 日/周/月复盘、完整上月对照、客观摘要与AI分析分开 |
| 使用反馈 | 新用户指引、真实入账与升级反馈、可关闭动效及减少动态效果支持 |
| 本地资料 | 指定文件夹、只读扫描、勾选文本交给AI、编辑/拒绝建议、确认后记录活动与待核实证据 |

## 本地资料怎么使用

1. 登录后打开 **产出台 → 本地资料**，选择学习笔记或作品所在的文件夹。
2. 查看清单，勾选本次文件；扫描不会发送正文或调用AI。
3. 确认允许所选内容交给当前AI服务，点击“交给AI整理建议”。
4. 核对原文摘录与不确定点，修改活动和证据文字，或拒绝建议。
5. 点击“确认记录活动与证据”后，才保存到本机数据库。证据固定为 **E0 / 未验证**；经验结算继续使用原有评估与确认流程。

原文件始终只读，不复制到公开网站、GitHub或云端Storage。**现有AI可能是云端模型，只有选中且明确同意发送的文本会交给它处理；“网站在本机”不代表AI离线。** 文件存在、笔记自述和AI推断都不能直接证明能力。

桌面Chrome/Edge支持记住连接，重开后可按提示重新授权；其他浏览器使用一次性目录选择。刷新清单是手动操作，不在后台监听；断开连接会清除记住的目录，进一步撤销权限可在浏览器站点设置操作。

首版读取UTF-8的Markdown、TXT、R/Python/JS/TS、JSON/CSV、HTML/CSS、TeX与Notebook文本。每文件最高128KB，每次最多8份、合计64,000字符；最多扫描200个可用文件、2,000项目、8层子目录。隐藏目录、依赖及明显密钥文件会跳过，但仍需用户检查敏感资料。**PDF、Office文档和图片暂不解析正文。** 正文哈希基于去除首尾空白后的UTF-8文本，用于来源版本去重，不冒充原文件的二进制哈希。

同一相对名称和同一正文版本重复确认会返回原活动。活动与证据沿用两个现有操作：证据失败时活动仍可能已保存，页面保留原请求用于补交证据。创建结果不明时停止自动重建，需先检查活动历史。未保存的AI建议有效1小时，服务重启后需要重新分析。

## 最近开发进展

本轮开发基于2026-10-16已核实的合并基线 [PR #65](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/65)，提交 `8fd9becf`。

- [PR #59](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/59)：活动材料提交，保持未验证证据边界。
- [PR #60](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/60)：事实修订和AI重评。
- [PR #61](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/61)：作品手动验收和首次愿望积分。
- [PR #62](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/62)：私有日/周复盘。
- [PR #63](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/63)：月度复盘、上月对照与真实成长反馈。
- [PR #64](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/64)：动效与开关。
- [PR #65](https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/65)：自定义任务进度增量。
- 本轮：本地资料文件夹与AI建议流程，以及README/开发进度同步；以本轮PR检查结果为最终验收依据。

PWA、手机局域网访问、更多外部服务集成、PDF/Office正文解析仍是后续候选，未列为已完成。公网发布不在当前范围。

## 技术与数据边界

Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、React Flow；本机Supabase/PostgreSQL、Auth、RLS与事务RPC；Vitest和真实数据库集成测试。

- 时间不是XP，XP不是掌握度；高掌握度需要证据。
- AI只出建议，确定性应用代码负责正式成长变更。
- 每笔经验必须能追溯到原始活动与账本。
- 材料提交、作品手动验收、独立验证是不同状态。
- 用户私有数据受认证与RLS保护，模型和数据库管理密钥仅在服务端。

## 本机启动

已有安装使用原桌面入口。新环境先准备Node.js、pnpm、本机Supabase和已配置的认证环境，再执行：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

默认入口：`http://127.0.0.1:3000`。生产运行使用 `pnpm build` 与 `pnpm start`；开发和生产脚本均默认只监听 `127.0.0.1`。

配置参考 `.env.example`，真实配置写入不跟踪的 `.env.local`。真实本机数据使用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；AI使用 `AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY`（或相应OpenAI环境变量）。本地资料API要求本机数据库与真实登录，不降级到Demo；未配置AI时不编造建议。

未配置Supabase的演示环境可使用既有本地JSON和模拟AI，这不代表真实评估或正式验收。桌面入口绑定已验提交与构建，升级时需一并验证启动绑定。

## 验证与文档

```bash
pnpm test
pnpm harness:deterministic
pnpm lint
pnpm build
```

数据库集成需隔离测试栈与 `XP_RPG_TEST_DB_URL`，不要指向个人正式数据库。跳过的检查不能算通过；CI的 `supabase-integration` 负责真实迁移、认证、RLS、事务和核心HTTP流程验证。GitHub通过测试不等于公网部署授权。

- [开发交接与历史状态](docs/MASTER_PROJECT_HANDOFF.md)
- [本机文件夹范围与验收](docs/SiteReadiness/26_LOCAL_FOLDER_LIBRARY.md)
- [本轮变更记录](CHANGELOG.md)
- [系统与产品规范](docs/Design%20ChatGPT/README_SPEC_PACK.md)