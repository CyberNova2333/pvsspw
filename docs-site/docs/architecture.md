---
repoGuideSource: repo-docs/README.md
---

# 架构全景与交互图谱

PVSSPW 把**工作台门禁与存档锁**、**四段补丁重编版 Vitaslop 核心**、**同设备 WebGPU 后处理纹理环**以及**离线基线对测编排**收拢在统一工程结构下，严格与商业游戏与系统固件隔离。

<DiagramFrame
  src="/diagrams/pvsspw-architecture.html"
  title="PVSSPW 浏览器工作台、Vitaslop 补丁核心与同设备零拷贝后处理架构图（支持平移 / 缩放 / 节点探查）"
  aspect="940 / 345"
  new-tab-label="在新窗口全屏打开 ↗"
/>

## 源码深潜入口与活文档总览

- [一次真实运行走查（源码）](/docs/walkthrough)：顺着安装 Web Lock -> 平台/显卡探测 -> SMP 策略选核 -> 同设备 AI 拦截 -> `pvsspw-submit` 探针追踪全部交接与拒绝边界；
- [代码地图（按职责定位）](/docs/code-map)：按 `web/`、`patches/`、`scripts/`、`bench/`、`tests/`、`results/` 索引改动入口与验证方式；
- [工程决策与对比口径](/docs/decisions)：核对三线程特例依据、互斥边界及 `repo-docs/change-log.md` 验证台账。

---

<!--@include: ../../repo-docs/README.md-->

---

<!--@include: ../../repo-docs/glossary.md-->
