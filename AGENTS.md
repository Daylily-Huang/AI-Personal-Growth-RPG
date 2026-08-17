<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Personal Growth RPG — Coding Agent Rules

Read in order before editing:

1. `docs/01_SYSTEM_RULES.md`
2. `docs/02_PRODUCT_DESIGN.md`
3. `docs/03_TECHNICAL_IMPLEMENTATION.md`
4. `docs/04_MVP_ROADMAP_AND_ACCEPTANCE.md`
5. `docs/05_AI_GAME_MASTER_CONTRACT.md`
6. `docs/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md`
7. `docs/07_UI_DESIGN_SYSTEM.md`
8. `docs/08_TESTING_EVALS_AND_QA.md`
9. `docs/09_PROJECT_GOVERNANCE_AND_CHANGE_CONTROL.md`

Priority: `01 > 02 > 03 > 04–10 > current implementation`.

## Non-negotiable invariants

- Time is not XP.
- XP is not Mastery.
- High Mastery requires Evidence.
- LLM produces proposals; application code commits permanent growth state.
- Final XP is computed by deterministic Growth Engine code.
- Every XP mutation must be traceable through the ledger.
- Repetition must reduce XP unless a real breakthrough occurs.
- Failure may produce Learning XP.
- Temporary state must not be confused with permanent capability.
- User-private tables require RLS.
- Never expose OpenAI or Supabase service-role secrets to the browser.
- Do not add gambling, loot-box, forced-streak, shame, or punitive engagement mechanics.

## Required harness after modifying core rules

- `src/lib/growth-engine/**` → `pnpm harness:deterministic`
- `src/lib/ai/prompts/**`, `src/lib/ai/schemas/**`, AI model config → `pnpm harness:llm:golden` (when available)
- confirmation flow, auth, RLS, migrations, XP transactions → `pnpm test` + `pnpm harness:deterministic`

## WSL DSH 环境同步（2026-08-17，宿主管理员写入，勿删）

- 本项目在 `/mnt/d`（9P/DrvFs）上运行，WSL dsh 工作区可正常使用；文件面板已改
  轮询监听，不要递归 watch node_modules。
- 项目接的本地桥接：`AI_BASE_URL=http://127.0.0.1:3099/v1`（.env.local）。
  桥接由 `wsl -d Ubuntu -- bash "/mnt/d/DSH WSL/wsl/setup-dsh-wsl.sh" start` 管理，
  不要自行 kill/重启；报 Connection error 先 `curl http://127.0.0.1:3099/v1/models`。
- 桥接链路：图片 → minimax-m3 描述 → deepseek-v4-flash 文本回答（Go 订阅计费）。
- 修改 DSH 供应商/预设配置前必须经用户确认；完整背景先读
  `D:\DSH WSL\wsl\HANDOFF-WSL-DSH.md` 第 8/9 节。