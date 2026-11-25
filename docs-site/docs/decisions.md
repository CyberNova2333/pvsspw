---
repoGuideSource: repo-docs/change-log.md
---

# 工程决策与对比口径（ADR 摘要）

| 决策项 | 当前选择 | 放弃方案与核心原因 | 源码依据 |
| --- | --- | --- | --- |
| Vitaslop 上游改造方式 | 仓库保存四段递增 `.patch` + `apply_stack` 校验 | 不把修改过的完整 MIT 上游文件直接混入第一方仓，保障重编基准与许可边界清晰 | `patches/*.patch`、`scripts/build_vitaslop.py` |
| 固件模块隔离方式 | 构建期抽取 `libsas.suprx` 独立生成 `vitaslop-sas.zip` | 严禁随核心产物夹带 `os0/vs0/sa0` 商业固件转储，并强制 SHA-256 摘要锁定 | `scripts/build_vitaslop.py` |
| 线程数策略（24 核 Intel Xe-LPG） | `PCSG00214` 特例直选 `3` 线程；其余按峰值九折选最少线程 | 实测微测速给出的 6 线程在真机游戏战斗下反因线程争用落后于 3 线程 | `web/thread-policy.js`、`tests/thread-policy.test.mjs` |
| 后处理与原生缩放协调 | `frameflow-worker.js` 三槽同设备环 + `GameSR` 时禁用 `fsr1` | 跳过跨设备 `copyExternalImageToTexture` 与阻塞回读，避免两套超分重复锐化 | `web/frameflow-worker.js`、`web/engine.js` |
| 对比与渲染信号口径 | 隔离端口保存独立状态；仅对主显示表面真实绘制计数 | 屏蔽着色器编译与离屏提交对首帧/帧率计时污染，`report.py` 强制核查截图哈希 | `scripts/serve.py`、`bench/worker-probe.js`、`scripts/report.py` |

---

<!--@include: ../../repo-docs/change-log.md-->
