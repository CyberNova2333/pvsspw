# PVSSPW 源码证据与调查台账

这是解释与证据边界台账：所有机制叙述与代码指向直接对应当前工作区真实文件。基准源码锚点为 `92b65f433d7a027f3210bbb35d71727087d04796`，纯代码单测、文档构建及浏览器真机实测结果各自单独记录。

## Evidence Traversal Log

| Pass | Purpose | Inspected evidence | What changed in the model |
| --- | --- | --- | --- |
| Pass 1 | 建立浏览器工作台入口、环境拦截与核心启动传参路径 | `web/shell.js`、`web/library.js`、`web/platform.js`、`web/graphics.js`、`web/engine.js`、`AGENTS.md` | 确立 Web Lock、JSPI/OPFS 检查、图形尝试枚举与 Worker 查询参数传递机制 |
| Pass 2 | 核查多线程抉择、四段 Rust 补丁、同设备纹理环与对测防伪边界 | `web/thread-policy.js`、`web/frameflow-worker.js`、`web/files.js`、`patches/*.patch`、`scripts/build_vitaslop.py`、`scripts/serve.py`、`scripts/report.py`、`bench/worker-probe.js`、`bench/fsr-passes.js`、`tests/thread-policy.test.mjs` | 补齐测速降档退避逻辑、`srActive` 与 `fsr1` 互斥规则、回环 POST 头严格校验及截图指纹防篡改检查 |

## 证据表

| Claim | Evidence | Confidence | Caveat | Used by |
| --- | --- | --- | --- | --- |
| 工作台启动导入或操作游戏库前申请即时独占锁并由专用工作线程核验导出存档 | [外壳控制](../../web/shell.js)：`storageLock`；[游戏库管理](../../web/library.js)：`install`；[存档恢复](../../web/files.js)：`exportSaves`、`restoreSaves` | Confirmed | 源码静态阅读；多线程存档工作器内部脚本未作深入展开 | [主流程](../walkthroughs/one-real-run.md)、[对测模块](../modules/benchmark-and-workbench.md) |
| 平台门禁将安全上下文、JSPI、离屏画布与 OPFS 同步句柄列为致命项 | [平台检查](../../web/platform.js)：`checkPlatform`、`testFilesystem` | Confirmed | 需在支持安全上下文环境下有效执行 | [主流程](../walkthroughs/one-real-run.md)、[代码地图](../code-map.md) |
| 图形探针枚举核心/兼容/后备三种模式并优先筛选非软件渲染适配器 | [图形探测](../../web/graphics.js)：`findGraphics`、`adapterOptions` | Confirmed | 已有专项单元测试校验筛选分支 | [主流程](../walkthroughs/one-real-run.md)、[代码地图](../code-map.md) |
| 线程决策按手动覆盖、特定硬件实测捷径、微测速九折与硬件上限回退分层处理 | [线程策略](../../web/thread-policy.js)：`chooseThreadPolicy`、`guestWorkerLimit`、`selectWorkerCount`；[策略单测](../../tests/thread-policy.test.mjs) | Confirmed | `tests/thread-policy.test.mjs` 通过内存替身测速验证全部分支逻辑 | [主流程](../walkthroughs/one-real-run.md)、[补丁与线程模块](../modules/core-patching-and-smp.md) |
| 同设备拦截器先于探针与核心启动，申请 `shader-f16` 并在 AI 开启时挂载三槽环 | [后处理拦截器](../../web/frameflow-worker.js)：`PRESETS`、`SR_PRESETS`、`ensureRingAndSession`；[引擎封装](../../web/engine.js)：`window.Worker` | Confirmed | 硬件渲染收益需结合硬件 GPU 对测；软件模式自动关闭所有 AI 预设 | [主流程](../walkthroughs/one-real-run.md)、[后处理模块](../modules/frameflow-and-fsr1-pipeline.md) |
| 开启 `GameSR` 时引擎发送 `output-size` 会显式屏蔽原生 `fsr1` 开关 | [引擎封装](../../web/engine.js)：`postMessage` 内 `!srActive` 判断；[原生通道补丁](../../patches/vitaslop-fsr1.patch)：`Fsr1` | Confirmed | 源码明确互斥条件防止同时执行两次放大处理 | [主流程](../walkthroughs/one-real-run.md)、[后处理模块](../modules/frameflow-and-fsr1-pipeline.md) |
| 构建脚手架按无状态树匹配递增合并四段补丁，并独立生成受校验的 `libsas.suprx` 覆盖包 | [构建脚本](../../scripts/build_vitaslop.py)：`apply_stack`、`make_overlay` | Confirmed | 构建本身依赖 Rust 1.98.0 与本地锁定的输入固件文件 | [补丁与线程模块](../modules/core-patching-and-smp.md)、[代码地图](../code-map.md) |
| 回环预览服务对本机重启浏览器接口强制校验回环 `Host`、`Origin` 与同源请求头 | [本地服务](../../scripts/serve.py)：`Player.do_POST`；[启动规约](../../scripts/edge_backends.py)：`BACKENDS` | Confirmed | 启动特定驱动组合仍取决于宿主设备是否安装对应 Vulkan ICD 与浏览器 | [对测模块](../modules/benchmark-and-workbench.md) |
| GPU 探针过滤心拍与离屏调用并报告真正写入主显示表面的唯一提交帧 | [GPU 探针](../../bench/worker-probe.js)；[FSR 取样脚本](../../bench/fsr-passes.js)；[制表脚本](../../scripts/report.py) | Confirmed | 纯文档构建不重新运行耗时的 600 秒实体或无头游戏对测 | [主流程](../walkthroughs/one-real-run.md)、[对测模块](../modules/benchmark-and-workbench.md) |
| 已归档的三线程对比表现优于六线程与双后端基准对比结论 | [对比报告](../../results/COMPARISON.md) 与 [线程策略源码](../../web/thread-policy.js) | Inferred | 援引既有对比结论，不可外推到未经测量的手机硬件型号 | [补丁与线程模块](../modules/core-patching-and-smp.md) |

## 反证与后续问题

反证检查（Falsifying check）：如果软件渲染模式下界面依然能够把 AI 插帧与超分启用开关发送进核心并产生计算缓冲分配，或者在开启 `GameSR` 后原生 `fsr1-easu`/`fsr1-rcas` 渲染通道依然被调用编码，即表明本指南关于后处理开关门禁与互斥关系的陈述已被打破。

下一位读者可能问（Next reader question）：如果我想新增一款其它游戏专用线程数特例或测试版补丁，应当只修改一处还是多处？若仅调整线程偏好，修改 `web/thread-policy.js` 并同步补充 `tests/thread-policy.test.mjs` 用例即可；若涉及补丁堆叠顺序变更，则需同步更新 `scripts/build_vitaslop.py` 中的补丁列表并从干净上游索引重新验证编译输出清单。

## 范围与未验证事项

本台账聚焦第一方浏览器逻辑、后处理封装、构建与对测驱动框架；上游 Vitaslop 仓库内部与 Vita3K Web 快照源码未作逐文件拆解，随包提供的 `web/vendor/frameflow/` 请对照上游 `frameflow` 指南审查。本轮只执行文档站建设与纯逻辑单测复核，桌面端重新编译 Wasm 或长窗口游戏渲染对测另行记账。

证据状态：除特别标注外，本页基于当前源码已确认。
