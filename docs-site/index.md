---
layout: home

hero:
  name: "PVSSPW"
  text: "PS Vita 网页模拟器与性能对测平台"
  tagline: "以四段源码补丁与 libsas 覆盖修复锁定版 Vitaslop，搭配自适应 SMP 线程池、同设备零拷贝 FSR 1 / FrameFlow（GameFI + GameSR 2×）与 Vita3K Web 对照基准。"
  actions:
    - theme: brand
      text: "起步与复现部署"
      link: /docs/
    - theme: alt
      text: "API 与探针参考"
      link: /api-reference/
    - theme: alt
      text: "补丁与线程契约"
      link: /docs/contracts
    - theme: alt
      text: "架构全景与图谱"
      link: /docs/architecture

features:
  - title: "四段补丁与自适应线程"
    details: "在锁定版 Vitaslop（MIT）基础上修复 ARM 跳转表与协程信号唤醒并单独打包 libsas.suprx，启动前基于并行微测速自动挑选线程池规模。"
  - title: "同设备零拷贝 AI 后处理"
    details: "在同一 GPUDevice 上通过三槽纹理环运行 GameFI（2×/3×）光流插帧与 GameSR 2× 超分，或切换原生双通道 WGSL FSR 1 空间锐化。"
  - title: "隔离工作台与 ZIP 存档校验"
    details: "提供 pvsspw-library Web Lock 互斥、ZIP/VPK 导入、rePatch 管理以及恢复前经独立工作线程验真的存档导入导出。"
  - title: "回环对比与 SHA-256 报告"
    details: "多端口回环 COOP/COEP 服务搭配 Playwright 无头/安卓跑步器、GPU 提交探针与强制核对图像哈希的 report.py。"
---

## 能力边界与明确非目标

::: info 能做到什么程度（已实现能力）
- 在纯本地回环服务下跑通补丁版单/多线程 Vitaslop 核心，支持 `libsas.suprx` 独立覆盖、工作台 `storageLock` 防破坏以及恢复前由 `/gamedata-worker.js` 核验的全量/单游戏存档 ZIP。
- 在硬件 WebGPU 下按需启用 `shader-f16`，支持 `GameFI`（`lite-2x`/`std-2x`/`lite-3x`/`std-3x`）、`GameSR`（`sr-lite`/`sr-std`）与原生两通道 `FSR 1`（`fsr1-easu` + `fsr1-rcas`）；全部参数与探针协议见 [API 与探针参考](/api-reference/)。
:::

::: warning 明确不做什么（边界与硬限制）
- **绝不分发商业 ROM、Vita 固件转储或 PSN 密钥**：日版测试归档、抽取的固件模块与用户游戏均保持 gitignore 忽略，由测试者在本地校验准备。
- **不包含云账号、联机后台或开放 HTTP 管理端**：`/__local/open-edge` 仅在启用启动器开关时校验同源回环四重请求头。
- **软件适配器自动禁用 AI 后处理**：遇 SwiftShader 等软件光栅器时强制标记 `uiPresent=software` 并关闭 `GameFI` / `GameSR`，桌面结果不未经实测外推实体手机表现。
:::

## 架构全景

<DiagramFrame
  src="/diagrams/pvsspw-architecture.html"
  title="PVSSPW 浏览器工作台、Vitaslop 补丁核心与同设备零拷贝后处理架构图（支持点击节点查看代码境界 / 平移 / 缩放）"
  aspect="940 / 345"
  new-tab-label="在新窗口全屏打开 ↗"
/>

## 快速上手演示

```sh
# 1. 运行纯 JS 单元测试（线程策略、显卡探测、GPU 提交探针）
node --test tests/*.test.mjs

# 2. 离线还原并核对基线静态播放器快照（93 个文件）
python3 scripts/prepare.py players

# 3. 启动固定构建版回环工作台服务（127.0.0.1:18747）
python3 scripts/serve.py vitaslop --fixed --port 18747
```

## 文档分层导航

::: tip 按照读者需求快速跳转
- **第一次搭建本地工作台与预览服务**：阅读 [输入准备、重编与回环服务](/docs/deployment) 与 [运行与对测排错 FAQ](/docs/troubleshooting)，还原快照并配置 COOP/COEP 回环环境；
- **查看源码补丁、选线程与 AI 后处理机制**：查阅 [Vitaslop 补丁、SMP 与输入契约](/docs/contracts) 与 [FSR 1、FrameFlow 后处理与对测基准](/docs/performance)；
- **定位代码模块与审核实验口径**：浏览 [架构全景与交互图谱](/docs/architecture)、[一次真实运行走查](/docs/walkthrough)、[代码地图](/docs/code-map) 与 [工程决策与对比口径](/docs/decisions)。
:::
