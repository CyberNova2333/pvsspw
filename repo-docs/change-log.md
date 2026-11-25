# 指南变更记录

| Timestamp | Request | Actions | Verification | Result |
| --- | --- | --- | --- | --- |
| 2026-11-25 11:04 Asia/Shanghai | 补齐 PVSSPW `repo-docs/` 中文源码指南并接入 VitePress 双语文档站与 Pages 工作流 | 新建 Standard 模式源码指南（总览、五步主流程、代码地图、三篇专题模块、术语表、源码证据、读者模拟复核），更新 `AGENTS.md`/`CLAUDE.md`、`meta.json`/`README*`，并构建 `docs-site/` 与 `.github/workflows/docs-pages.yml` | `validate_repo_docs.py`（0 errors, 2既有许可文本警告）；`pnpm --dir docs-site test`（1/1 通过）；`vitepress build --base /pvsspw/`（1.75s 通过）；`node --test tests/*.test.mjs`（11/11 通过）；`meta.json` & UTF-8 校验通过 | Synced through 92b65f433d7a027f3210bbb35d71727087d04796；上述校验已于本次提交前完整实跑通过 |

## 本轮验证与范围边界

- 文档站点构建输出（VitePress 默认主题）与工作台自身运行时目录相互隔离，不打包商业样本测试产物、固件转储或大体积快照归档。
- 纯 JS 策略/探针单元测试、结构校验与 VitePress 构建已于本轮实际执行通过；重编 Vitaslop 原生 Wasm 与桌面/移动端长时游戏战斗实测仍以既有验收口径单列，未在本轮文档变更中重跑。

Synced through 92b65f433d7a027f3210bbb35d71727087d04796
