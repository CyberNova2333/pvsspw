# AGENTS.md —— PVSSPW 协作与维护约定

## 常用验证命令

```sh
# 1. Node 纯逻辑与策略单元测试
node --test tests/*.test.mjs

# 2. 本地固定服务 + 无头 Edge 157 工作台集成测试（需先构建或准备 vitaslop 构建产物）
python3 scripts/serve.py vitaslop --fixed --port 18747
VK_DRIVER_FILES=/usr/share/vulkan/icd.d/intel_icd.json node tests/workbench.mjs --intel
```

## 内容与许可红线

- **严禁提交或分发游戏与固件**：仓库不得包含商业 PS Vita ROM、加密内容、`os0/vs0/sa0` 固件转储、PSN 密钥或用户存档；测试产物目录 `artifacts/`、`.cache/` 与 `resources/` 保持 gitignore 忽略。
- **上游多许可边界**：
  - `patches/*.patch` 对应的 Vitaslop 上游源码继续遵循 `MIT`（`web/vitaslop-license.txt`）；
  - `bench/runtime/players.tar.gz` 中的 Vita3K Web 快照遵循 `GPL-2.0-or-later`（`bench/runtime/vita3k-LICENSE.txt`）；
  - 随静态界面分发的 `web/vendor/frameflow/` 包含 `GameFI` 与 `GameSR` 运行时及紧凑权重模型，遵循 `AGPL-3.0-only` 与附加条款 `v1.6.7-r4`；同步运行时请直接以 `frameflow` 仓库为上游真源。
- **共享 `GPUDevice` 零拷贝约束**：`web/frameflow-worker.js` 在 `worker-probe.js` 与模拟器 Worker 前加载并启用 `shader-f16`（可用时），热路径禁止引入跨设备 `copyExternalImageToTexture` 往返或阻塞式 `mapAsync` 回读。

## 提交与签名约定

- 提交标题遵循 Conventional Commits：`type(scope): 中文描述`（允许 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`、`data`，不超过 100 字符）。
- 人类贡献者为 Git `Author`，AI 编程助手仅作为 `Co-authored-by` 尾注参与者（只写通用工具名，不写具体模型档位或版本）。
- 非初始提交须使用人类维护者已配置的 SSH 签名密钥签名（`gpg.format=ssh`）。

## Repo docs

`repo-docs/` is the living guide; start with [the reading path](repo-docs/README.md) and [the main walkthrough](repo-docs/walkthroughs/one-real-run.md).
This repo's `repo-docs/` guide is reader-facing Chinese documentation. When updating reader-facing guide pages, use `repo-docs-zh` when available; keep Chinese reader handles in the prose and preserve exact source identifiers for lookup.
Read current source, scripts and tests before treating the guide as implementation truth. Repo questions, behavior changes, user uncertainty, stable knowledge discovered in conversation, and knowledge about to be saved to memory trigger a foreground sync gate with `repo-docs` Sync mode when available (otherwise inspect the guide and source manually).
Choose `none`, `answer-only`, `foreground patch`, or `background sync`. Patch the smallest owning page before the final answer when a durable local gap would mislead; use background sync only with a real tracked handoff and no answer-critical gap. Do not rewrite docs for transient debug state.
Update the walkthrough for input/output or boundary changes and the code map for responsibility changes. Record meaningful guide changes and actual verification in `repo-docs/change-log.md` with `Synced through <sha>`; do not imply unrun tests passed.

文档站统一复用同作者仓库共享主题（蓝网格、纯享模式、`<DiagramFrame>` 与 `<ApiExplorer>` 组件，构建输出独立于工作台界面）。

## 项目简介与主页元数据 (`meta.json`)

- **项目名称**：PVSSPW · 基于 Vitaslop 的网页版 PS Vita 模拟器与性能对测平台
- **仓库地址**：`https://github.com/CyberNova2333/pvsspw`
- **分类与主语言**：`media-engine` · `JavaScript` / `WebAssembly` / `WebGPU`
- **同步规则**：调整核心功能、画质后处理管线或公开状态时，须同步更新根目录 [`meta.json`](meta.json) 与中英文 README。
