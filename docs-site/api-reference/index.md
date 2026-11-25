# 工作台参数、后端与探针 API 参考

本页依据 `web/engine.js`、`web/thread-policy.js`、`web/frameflow-worker.js`、`scripts/edge_backends.py`、`scripts/serve.py` 与 `bench/worker-probe.js` 整理内部控制协议与参数。

## `worker.js` 查询参数协商 (`web/engine.js`)

当 `/worker.js` 创建并存在已探测图形配置时，`window.Worker` 自动追加以下查询参数：

| 参数名 | 取值来源 / 候选值 | 作用说明 |
| --- | --- | --- |
| `uiGpu` | `high-performance` / `low-power` 等 | 指定适配器电源偏好 |
| `uiMode` | `core` / `compatibility` / `fallback` | 指定 WebGPU 请求兼容模式 |
| `uiPresent` | `'software'`（仅软件适配器设置） | 通知后端切换二维画布回退渲染并禁用 `GameFI` / `GameSR` |
| `uiFrameflow` | `off` / `lite-2x` / `std-2x` / `lite-3x` / `std-3x` | 启用光流插帧并配置预设与目标倍率 |
| `uiSr` | `off` / `sr-lite` / `sr-std` | 启用 2× AI 超分；启用时抑制原生 `fsr1` |

## 宿主控制桥 `window.vitaPlayer` (`web/engine.js`)

- `start(title, selectedGraphics?)` / `stop()`：应用设置、执行 `chooseThreadPolicy()`、启动游戏并将路由更新为 `#/play/<titleId>`。
- `setFrameflow(preset)` / `setGameSr(preset)`：向正在运行的核心工作线程实时发送 `pvsspw-frameflow` 与 `pvsspw-sr` 预设切换消息。
- `flush()`：向工作线程发送 `flush-game-data`，触发即时写盘同步。
- `resizeOutput()` / `menu()` / `resume()` / `screenshot()`：调整缩放输出、控制游玩菜单以及在软件渲染下从 `#softwareScreen` 导出 PNG 截图。

## 回环服务端同源启动校验 (`POST /__local/open-edge`)

仅在携带启动器选项启动 `scripts/serve.py` 时开放，强制核对以下全部条件（缺失任一项即返回 `403` 或 `400`）：
- `Host` 须为 `127.0.0.1:<port>` 或 `localhost:<port>`；
- `Origin` 须精确等于 `http://<Host>`，`Sec-Fetch-Site` 须为 `same-origin`；
- 请求头须包含 `X-PVSSPW-Action: open-edge`，请求体长度 `0..256` 字节，且 `backend` 命中 `BACKENDS`（`webgpu`、`vulkan`、`nvidia`、`opengl`、`software`）。

## 性能探针与通路标签

- **GPU 提交探针 (`bench/worker-probe.js`)**：仅当 `queue.submit` 的命令缓冲区实际写入通过 `getCurrentTexture()` 获知的新主表面纹理时，才派发 `{ type: 'pvsspw-submit', time }`，屏蔽编译心跳与离屏渲染噪音。
- **FSR 1 与三槽纹理环调试标签**：原生通道为 `present-scale`、`fsr1-easu`、`fsr1-rcas`（ scratch 纹理 `fsr1-scratch`）；共享环纹理依次命名为 `frameflow-ring-0`..`frameflow-ring-2`。
