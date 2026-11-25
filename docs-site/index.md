---
layout: home

hero:
  name: "PVSSPW"
  text: "基于 Vitaslop 的 PS Vita 网页模拟器与对测工作台"
  tagline: "集成四段源码补丁与 libsas 覆盖、自适应 SMP 线程池、同设备零拷贝 FrameFlow (GameFI + GameSR 2×) 与 FSR 1，以及可复现 Vita3K Web 对测流水线。"
  actions:
    - theme: brand
      text: "起步与复现基准"
      link: /docs/
    - theme: alt
      text: "API 与探针参考"
      link: /api-reference/
    - theme: alt
      text: "架构与源码指南"
      link: /docs/architecture

features:
  - title: "四段补丁与自适应线程"
    details: "在锁定版 Vitaslop（MIT）基础上修复 ARM 跳转表与协程唤醒并单独打包 libsas.suprx，启动前基于并行微测速自动挑选线程池规模。"
  - title: "同设备零拷贝 AI 后处理"
    details: "在同一 GPUDevice 上通过三槽纹理环运行 GameFI（2×/3×）光流插帧与 GameSR 2× 超分，或使用原生双通道 FSR 1 空间锐化。"
  - title: "隔离服务与无干扰对测"
    details: "提供带 COOP/COEP 响应头的多端口本地预览服务、图形后端探测以及逐像素/GPU 提交信号捕获脚本，独立存档与哈希验证。"
---

::: info 已实现能力
- 在本地浏览器运行带 ZIP/VPK 导入、OPFS 持久化、`rePatch` 覆盖、自适应多线程及纯前端存档导出/结构校验的工作台壳层。
- 在硬件 WebGPU 模式下按需启用 `shader-f16`，支持 `GameFI`（`lite-2x` / `std-2x` / `lite-3x` / `std-3x`）、`GameSR`（`sr-lite` / `sr-std`）与原生 `FSR 1`（`fsr1-easu` + `fsr1-rcas`）。
:::

::: warning 明确不做什么
- **绝不分发商业游戏镜像、Vita 固件转储或 PSN 密钥**：所有样本归档与覆盖包由测试者在本地校验提取，不提交仓库或发布站。
- **不包含云端账号或公网管理服务**：本地回环服务器严格校检同源请求头与 256 字节负载上限。
- **软件渲染禁用 AI 后处理**：遇 SwiftShader 等软件适配器时自动降级为二维画布并关闭 `GameFI` / `GameSR`，桌面实测结论不直接外推实体手机表现。
:::

## 本地快速起步与离线检验

```sh
# 1. 运行纯 JS 单元测试（线程策略、图形降级与对测探针）
node --test tests/*.test.mjs

# 2. 离线还原并核对基线静态播放器快照（93 个文件）
python3 scripts/prepare.py players

# 3. 启动固定构建版回环工作台服务（127.0.0.1:18747）
python3 scripts/serve.py vitaslop --fixed --port 18747
```
