# 概览与运行边界

**PVSSPW**（PlayStation Vita Simulator Suitable for Playing on the Web）将修复补丁后的 **Vitaslop**（MIT）与同一工作台壳层、离线播放器对照快照（`Vita3K Web`）及零拷贝后处理链路收拢到统一仓内，用于对比评测不同核心、多线程调度与画质后处理方案的实际表现。

## 核心层级与工作区职责

| 层级 | 目录 | 职责说明 |
| --- | --- | --- |
| 浏览器工作台壳层 | `web/` | 游戏库并发锁、JSPI/OPFS/WebGPU 门禁、自适应选线程、同设备 AI 后处理与存档校验 |
| 核心递增补丁 | `patches/` | 修复重定位解码、输入流控、战斗唤醒问题以及接入原生两通道 `FSR 1` |
| 构建、服务与脚本 | `scripts/` | 还原快照、增量重编、COOP/COEP 回环服务、无头/安卓运行器与实测制表 |
| 探针、单测与结果库 | `bench/`、`tests/`、`results/` | 零干扰 GPU 提交探针、同帧对比截帧、策略单测与 SHA-256 锁定对比报告 |

## 前置运行门禁 (`checkPlatform` / `findGraphics`)

- **安全上下文与核心能力**：启动前要求 `isSecureContext`、WebAssembly、JSPI（`WebAssembly.Suspending`）、`OffscreenCanvas.transferControlToOffscreen` 与专用探针实测的 OPFS 同步文件句柄就绪，缺失任何一项即报告 `fatal` 级拦截。
- **跨源隔离**：回环预览服务统一注入 `COOP: same-origin` 与 `COEP: require-corp` 以解锁多线程 `SharedArrayBuffer`。
- **硬件显卡优先筛选**：专用 Worker 按 `core` → `compatibility` → `fallback` 尝试创建 WebGPU 设备；遇到软件光栅器标记时会尝试寻找硬件适配器。

下一步：阅读 [输入准备、重编与回环服务](/docs/deployment) 或查看 [API 与探针参考](/api-reference/)。
