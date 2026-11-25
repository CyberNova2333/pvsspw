# 安全说明 / Security

<!-- repo-maintenance:begin -->
## 本地开发与服务安全边界 / Local development and service boundaries

1. **禁止入库游戏/固件与私密凭据**：任何本地测试所需的 `.zip`、`.vpk`、固件提取包（`os0`/`vs0`/`sa0`）、日志截图目录（`artifacts/`、`.cache/`、`resources/`）与私密凭据均不得提交进仓库。
2. **回环服务与响应头隔离**：`scripts/serve.py` 仅监听 `127.0.0.1` 并严格校验路径穿越，同时注入 `COOP: same-origin` 与 `COEP: require-corp`；`/__local/open-edge` 仅在显式传参 `--edge-launcher` 且校验 `Host`、`Origin`、`Sec-Fetch-Site: same-origin` 与专用请求头后放行。
3. **第三方下载源限制**：工作台「在线下载」仅校验用户显式提供的 HTTPS/回环清单及逐块 SHA-256 摘要，不内置任何游戏目录或远端下载站。

## 漏洞与合规问题报告 / Reporting vulnerabilities and licensing issues

如发现路径遍历、跨源隔离绕过、沙箱安全隐患或上游许可证/署名遗漏，请通过 GitHub 仓库的私密安全通道或直接联系维护者（CyberNova）反馈，切勿在公开 Issue 中披露未脱敏凭据或第三方受版权保护素材。
<!-- repo-maintenance:end -->
