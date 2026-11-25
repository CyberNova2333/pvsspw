# 运行与对测排错 FAQ

本页汇总浏览器前置门禁、`GameFI`/`GameSR` 软件降级限制、存档校验拒绝以及本地预览接口报错的常见原因。

## 1. 界面提示缺失致命能力（`fatal`）无法启动游戏

- **排查要点**：按 `web/platform.js`（`checkPlatform`），以下任一缺失会标为 `fatal`：安全上下文（`isSecureContext`）、WebAssembly、JSPI（`WebAssembly.Suspending`）、`OffscreenCanvas.transferControlToOffscreen` 或 OPFS 同步文件句柄（`/probe-worker.js` 5 秒超时）。
- **常见触发原因**：通过局域网明文 HTTP IP 打开工作台（非 `127.0.0.1` / `localhost`）时，浏览器禁用 OPFS 同步句柄与安全上下文特性。

## 2. 启用了 `GameFI` 或 `GameSR`，但实际未运行或切换后自动失效

- **原因 A（软件适配器降级）**：当显卡探针仅找到 SwiftShader / llvmpipe 等软件适配器时，`web/engine.js` 注入 `uiPresent=software`，`frameflow-worker.js` 会强制屏蔽 AI 后处理并改用 `softwareScreen` 二维画布呈递。
- **原因 B（与 FSR 1 互斥）**：开启 `GameSR` 2× 超分时 `engine.js` 显式压制原生 `fsr1` 标识，防止两次超分叠加失真与开销翻倍。

## 3. 恢复存档 ZIP 被拒绝提示格式不符或重名

- **校验逻辑**：`web/files.js` 中的 `restoreSaves()` 对每个条目强制匹配 `[A-Za-z0-9_-]+.zip` 并投递到 `/gamedata-worker.js` 做结构摘要验证；如选择单游戏覆盖却传入全量合集 ZIP，或存档文件受损，会直接在确认覆盖前中断报错。

## 4. `POST /__local/open-edge` 返回 `403` / `404` / `400`

- **检查项**：`serve.py` 仅在携带启动器开关时响应此路径，并逐项校验 `Host`（回环端口）、`Origin === http://<Host>`、`Sec-Fetch-Site === same-origin`、`X-PVSSPW-Action === open-edge`、负载字节数 `<= 256` 及目标主机上对应驱动与浏览器可执行文件确实就绪。
