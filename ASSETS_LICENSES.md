# PVSSPW 人员署名、AI 工具、代码与资产许可综合清单

**标准文件名：** `ASSETS_LICENSES.md`  
**配套模板版本：** v1.6.7-r4  
**项目名称：** `PVSSPW`  
**开发、维护或联合推出主体：** `CyberNova`  
**上游仓库地址：** `https://github.com/CyberNova2333/pvsspw`  
**记录覆盖范围及尚未核实部分：** 本清单记录本仓库第一方代码（`web/` 壳层与 FrameFlow Worker 接入、`scripts/`、`tests/`、`results/`、`patches/`）、随仓分发的静态前端供应商依赖及可追溯测试基线快照；不包含用户本地按需准备的测试游戏 ZIP 与 Vita 固件文件。  
**清单最后更新日期：** `2026-11-25`  
**配套附加条款：** [中文完整文本](./LICENSE-ADDITIONAL_TERMS-zh-CN.md)；[英文参考译文](./LICENSE-ADDITIONAL_TERMS-en.md)；[工程实施指南](./IMPLEMENTATION-GUIDE.zh-en.md)

## 一、本项目人类作者与贡献者 (Project Human Authors & Contributors)

### 1.1 主体、角色与贡献记录

| 记录编号 | 姓名、笔名或组织名称及真实角色 | Git 或平台账户关联 | 实际贡献及材料范围 | 提交、PR 或其他事实依据 | 附加条款意见状态及授权记录编号 |
| --- | --- | --- | --- | --- | --- |
| `P-01` | CyberNova（项目维护者、原作者、版权持有人；Git 角色：Committer, Author） | `https://github.com/CyberNova2333` / `295488275+CyberNova2333@users.noreply.github.com` | 本仓库原创编写的 `scripts/`、`tests/`、`results/` 文档、`web/{engine,files,frameflow-worker,game-pages,gpu-preference,graphics,graphics-probe,idle-motion,index,library,platform,shell,thread-policy,thread-probe,touch-directions}.*`、`bench/` 测量探针及自研 `patches/*.patch` 修改部分 | 本仓库 Git 历史及根目录 `meta.json` | `[附加条款：已明确同意]`（见 `AUTH-01`） |

### 1.2 授权事实与范围索引

| 授权记录编号及关联主体 | 实际声明主体与代表权限依据 | 材料、提交及版本范围 | 附加要求的覆盖范围 | 第 9.5—9.6 款附加许可的覆盖范围 | 声明、有效许可或证明依据 |
| --- | --- | --- | --- | --- | --- |
| `AUTH-01`；`P-01` | CyberNova（本人） | 仅限于本人享有版权的第一方原创部分；不覆盖上游 MIT Vitaslop、`bench/runtime/` Vita3K Web 或其他第三方独立材料 | 已明确同意适用 [`LICENSE-ADDITIONAL_TERMS-zh-CN.md`](LICENSE-ADDITIONAL_TERMS-zh-CN.md) **v1.6.7-r4** 全部附加要求 | 已明确授权适用 [`LICENSE-ADDITIONAL_TERMS-zh-CN.md`](LICENSE-ADDITIONAL_TERMS-zh-CN.md) **v1.6.7-r4** 第 9.5—9.6 款有条件附加许可 | 仓库根目录 [`meta.json`](meta.json)（`additionalTermsConsent.CyberNova = true`） |

## 二、AI Agent 与自动化辅助工具 (AI Agents & Automated Assistants)

| 工具记录编号及工具类别或名称 | 技术账户、机器人或环境标识 | 经核实的使用、控制或提交上下文 | 辅助范围及相关提交或材料 | 实际主体或组件记录关联 | 核实情况与必要说明 |
| --- | --- | --- | --- | --- | --- |
| `T-01`；gemini-code-assist（AI 编程辅助工具） | `200291788+gemini-code-assist@users.noreply.github.com` | 在人类维护者（`P-01` CyberNova）指令与审阅下参与工程辅助（Git 角色：Co-authored-by） | FrameFlow 接入整合、命名同步、测试脚本、文档与元数据整理 | `P-01`（工具本身非版权许可授权主体） | 依附加条款第 1.4、1.8 款仅作工程辅助记录，不创设独立许可授权状态 |

## 三、上游基线、依赖与第三方代码组件 (Upstream Baselines, Dependencies & Third-Party Code)

### 3.1 代码组件与原始作者主清单

| 组件编号及名称 | 类型与实际引入方式 | 仓库位置 | 上游来源及所采用版本或提交 | 原始作者与有效许可证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `C-01`；Vitaslop（PS Vita Wasm/WebGPU 播放器核心） | 锁定快照与本地源码补丁集 | `bench/runtime/players.tar.gz`、`patches/*.patch`、`web/vitaslop-license.txt` | https://github.com/cretz/vitaslop（提交 `a6bd7788c9205ab9208f1970bc2de8e49e3ccd2e`） | Chad Retz（`MIT`；见 `web/vitaslop-license.txt` 与 `bench/runtime/vitaslop-LICENSE.txt`） | 本仓按 MIT 保留原文，构建时经 `scripts/build_vitaslop.py` 拉取锁定提交并打补丁 |
| `C-02`；Vita3K Web（对照测试播放器快照） | 静态部署基准快照 | `bench/runtime/players.tar.gz`、`bench/runtime/vita3k-LICENSE.txt` | https://github.com/notwindstone/vita3k-web（提交 `4c8ead371ef4e6a1f2cef2504ef12a441bcb4ee2`） | Vita3K / notwindstone（`GPL-2.0-or-later`） | 仅用于离线回环对比基准测试；完整许可文本见 `bench/runtime/vita3k-LICENSE.txt` |
| `C-03`；PPSSPW 派生界面外壳、昼夜切换、分块下载器与上游声明 | 同作者上游仓迁移与本地适配 | `web/vendor/{browser-storage,day-night-switch,download-worker,game-download,online-games}.js`、`web/vendor/{player-controls,ppsspw}.css`、`web/vendor/{LICENSE,LICENSE.TXT,NOTICE.txt,LICENSE-ADDITIONAL_TERMS-*}` | https://github.com/CyberNova2333/ppsspw（修订 `124e208514c0040f3e3a5cabc61f845286b9474f`） | CyberNova（`AGPL-3.0-only` + 附加条款 v1.6.7-r4）及 PPSSPW 声明中保留的上游 `GPL-2.0-or-later` / PSPSDK BSD 声明 | 具体迁移范围与声明见 [`web/vendor/NOTICE.txt`](web/vendor/NOTICE.txt) |
| `C-04`；FrameFlow（`GameFI` 插帧 + `GameSR` 超分运行时与权重） | 同作者配套子模块静态同步 | `web/vendor/frameflow/`（含 `GameFI-Lite` / `GameFI-Std` / `GameSR-Lite` / `GameSR-Std`） | https://github.com/CyberNova2333/frameflow | CyberNova（`AGPL-3.0-only` + 附加条款 v1.6.7-r4） | 完整许可文本随包位于 [`web/vendor/frameflow/LICENSE`](web/vendor/frameflow/LICENSE) |
| `C-05`；Lucide Icons 与 Playwright (`playwright-core`) | 静态图标版权声明及开发测试依赖 | `web/vendor/LICENSE-lucide.txt`、`package.json` | Lucide Contributors / Microsoft Playwright | `ISC`（Lucide）、`Apache-2.0`（`playwright-core`） | 仅测试/界面图标所需，与 AGPL-3.0-only 兼容 |
| `C-06`；Anime.js 4.5.0 | 第三方内嵌脚本（静态复制，仅文档站动效使用） | `docs-site/.vitepress/theme/vendor/animejs/` | https://github.com/juliangarnier/anime（v4.5.0） | Julian Garnier（`MIT`；原文见 `LICENSE.md`） | 仅随独立 `docs-site/` 构建静态分发，未修改上游代码 |

### 3.2 原始许可与附加条款状态

- `C-01`（MIT）、`C-02`（GPL-2.0-or-later）、`C-05`（ISC / Apache-2.0）与 `C-06`（MIT）：`[附加条款：不适用（遵循原上游许可证）]`；各自完整原文或说明保留于上述对应文件。
- `C-03`、`C-04` 中的 CyberNova 原创部分：`[附加条款：已明确同意]`（随项目主体 `P-01` 一并保留完整 `AGPL-3.0-only` 与 `v1.6.7-r4` 文本）。

## 四、独立美术、字体与项目标识资产 (Independent Artwork, Fonts & Project Identifiers)

| 资产编号与名称 | 实际文件与来源 | 作者 / 版权持有人 | 有效许可证 | 随包与使用说明 |
| --- | --- | --- | --- | --- |
| `A-01`；PVSSPW 标志与名称标识 | `web/brand.svg` 及项目名称 `PVSSPW` | CyberNova（`P-01`） | `AGPL-3.0-only`（适用附加条款第五、八条） | 项目默认视觉符号与文字标识；下游二次分发可依第八条替换或更名 |
| `A-02`；IBM Plex Sans（网页与文档站自托管字体） | `web/vendor/fonts/ibm-plex-sans-latin-*.woff2`、`LICENSE-IBM-Plex-Sans.txt` 及 `docs-site/.vitepress/theme/fonts/` | IBM Corp.（`Copyright 2019 IBM Corp. All rights reserved.`） | `SIL OFL 1.1`（无保留字体名称 RFN） | 静态随网页及文档站字体目录提供，完整 OFL-1.1 原文保留于对应字体目录 |
| `A-03`；JetBrains Mono（文档站自托管字体） | `docs-site/.vitepress/theme/fonts/jetbrains-mono-latin-500-normal.woff2`、`LICENSE-jetbrains-mono.txt` | The JetBrains Mono Project Authors | `SIL OFL 1.1`（无保留字体名称 RFN） | 随 `docs-site` 构建静态分发，完整 OFL-1.1 原文位于 `docs-site/.vitepress/theme/fonts/LICENSE-jetbrains-mono.txt` |
