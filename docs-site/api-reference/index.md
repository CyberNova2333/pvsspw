---
layout: page
sidebar: false
title: API 与探针参考
description: PVSSPW 的 checkPlatform/findGraphics 门禁、存档校验、chooseThreadPolicy 自适应选核、同设备 frameflow-worker 纹理环、serve.py 与 GPU 探针参考。
---

<script setup lang="ts">
import { apiSpecZh } from '../.vitepress/data/api-spec'
</script>

<ApiExplorer :spec="apiSpecZh">

### 启动前置环境与显卡探测 (`checkPlatform` / `findGraphics`) {#platform-and-graphics}

校验安全上下文、JSPI、OffscreenCanvas 与 OPFS 同步文件句柄（缺失即报 `fatal`）；在 Worker 内探测硬件 WebGPU 适配器并识别软件回退。

### 存档 ZIP 导出与结构校验 (`exportSaves` / `restoreSaves`) {#save-zip-validation}

支持单游戏或全档案 ZIP 备份，并在恢复覆盖前经 `/gamedata-worker.js` 结构检验与弹窗确认。

### 自适应 SMP 线程池决策 (`chooseThreadPolicy`) {#thread-policy}

依据用户开关、已知硬件特例（Intel Xe-LPG `PCSG00214` 固定 3 线程）与并行微测速峰值九折选出最优工作线程数。

### 同设备零拷贝后处理环与 FSR 1 互斥 (`frameflow-worker.js`) {#frameflow-worker-bridge}

按序加载拦截器请求 `shader-f16`，经 `frameflow-ring-0..2` 运行 `GameFI` / `GameSR` 并在启用 AI 超分时关闭原生 `fsr1`。

### 回环服务、同源启动与 GPU 提交探针 (`serve.py` / `worker-probe.js`) {#serve-and-probes}

注入 COOP/COEP 响应头并强核对 `/__local/open-edge` 同源四重请求头；`worker-probe.js` 只对写入主画布的独特提交发送 `pvsspw-submit`。

</ApiExplorer>
