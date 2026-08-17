# Harness Starter

建议 Coding Agent 将本目录内容迁移到项目根目录的 `harness/`，并根据实际 Growth Engine API 调整 imports。

## 推荐实施顺序

1. 先接 deterministic runner。
2. 添加 Golden Cases。
3. 让 Vitest 全部通过。
4. 再接真实 AI assessment function。
5. 最后加 Playwright 与 CI。

不要在 Growth Engine 尚未实现时硬造一套假的业务函数。
