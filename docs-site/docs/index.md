# 概览与能力边界

**PVSSPW**（PlayStation Vita Simulator Suitable for Playing on the Web）将修复补丁后的 **Vitaslop**（MIT）与同一工作台壳层、离线播放器对照快照（`Vita3K Web`）及零拷贝后处理链路收拢到统一仓内，用于在浏览器环境下研究 PS Vita 模拟运行时表现与画质后处理。

## 核心层级与运行入口

| 层级 | 目录 | 职责说明 |
| --- | --- | --- |
| 浏览器工作台壳层 | `web/` | 游戏库安装锁、平台检查（JSPI / OPFS）、图形适配探索、自适应选线程及同设备 AI 后处理桥接 |
| 核心递增补丁 | `patches/` | 修复重定位解码、输入控制、战斗唤醒问题以及接入原生两通道 `FSR 1` |
| 构建、服务与脚本 | `scripts/` | 还原对比快照、增量编译、COOP/COEP 回环服务、无头/安卓试跑与对比报告生成 |
| 采样探针与单测 | `bench/` 与 `tests/` | GPU 提交探针、同帧 FSR 截帧对比，以及纯 JS 策略和工作台集成检查 |

## 前置运行门禁 (`checkPlatform` / `findGraphics`)

- **安全上下文与底层能力**：启动前要求 `isSecureContext`、WebAssembly、JSPI（`WebAssembly.Suspending`）、`OffscreenCanvas.transferControlToOffscreen` 与 OPFS 同步文件句柄全部就绪（任一缺失即在界面给出 `fatal` 级拦截提示）。
- **跨源隔离**：建议开启 `COOP: same-origin` 与 `COEP: require-corp` 以解锁多线程 `SharedArrayBuffer` 调度。
- **图形适配器筛选**：在专用 Worker 内逐档尝试 `core` / `compatibility` / `fallback` 模式创建 `WebGPU` 设备，优先选中硬件设备。

继续阅读：[准备、重编与本地服务](/docs/setup)、[对测方法与战斗复现](/docs/benchmarks) 或 [工作台参数、后端与探针 API](/api-reference/)。
