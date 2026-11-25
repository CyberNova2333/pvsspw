# PVSSPW 代码地图

先阅读[主流程与拒绝边界](walkthroughs/one-real-run.md)，再按职责定位具体模块入口。本页只索引经过本轮源码核对的关键路径，仓库内快照归档与单次实验运行产生的 JSON 汇总遵循各自目录边界。

| 路径 | 职责 | 关键代码 | 与主流程的关系 |
| --- | --- | --- | --- |
| `web/` | 工作台外壳、环境探测、引擎桥接与 AI 后处理工作器 | `shell.js / engine.js / frameflow-worker.js` | 用户交互入口及浏览器端多线程与 GPU 后处理运行体 |
| `patches/` | 针对锁定版本 Vitaslop 的指令翻译、音视频与 FSR 1 补丁 | `vitaslop-firmware.patch / vitaslop-fsr1.patch` | 通过构建脚本编译为独立单/多线程 Wasm 核心 |
| `scripts/` | 离线素材核验、核心重编、本地服务、浏览器对测与制表 | `build_vitaslop.py / serve.py / run.mjs / report.py` | 驱动完整构建、安全预览与跨浏览器对照实验 |
| `bench/` | 基线指纹锁、图形提交探针、像素比对着色器与 FSR 三图取样 | `worker-probe.js / fsr-passes.js / fsr-comparison.mjs` | 在运行期零改动生产管线的情况下捕获真实帧信号 |
| `tests/` | 纯逻辑单元测试与工作台及 FSR 自动化回归用例 | `thread-policy.test.mjs / workbench.mjs` | 验证选线程规则、环境探测、探针计数与桌面界面 |
| `results/` | 经筛选验证的 JSON 运行记录、对比报告与评审截图帧 | `COMPARISON.md / cases.json / DESKTOP-FIRST-FRAME.md` | 对外呈现的实测证据与对比依据 |

## `web/`

承载独立浏览器界面的全部逻辑，覆盖游戏安装导入、浏览环境门槛拦截、手柄/触摸适配、GPU 能力试探与共享设备后处理；随包静态分发的 `vendor/frameflow/` 由 `frameflow` 仓库同步而来。

| 重要代码 | 功能 | 关键符号 | 调用方 / 使用方 |
| --- | --- | --- | --- |
| [工作台外壳控制](../web/shell.js) | 管理栏目页签、游戏库 `pvsspw-library` 并发锁、日志与 toast 反馈 | `storageLock / tab` | 工作台主界面 |
| [游戏库与补丁管理](../web/library.js) | 解析压缩包元信息并登记至本地数据库，支持附加 `rePatch` 覆盖包 | `install / patch / removeGame` | 工作台外壳事件回调 |
| [游戏存档导出与检验](../web/files.js) | 打包单游戏或全部存档 ZIP，恢复前调用专用 Worker 检验内容 | `exportSaves / restoreSaves / validateSave` | 游玩配置面板与存档导出 |
| [安全上下文与 OPFS 检查](../web/platform.js) | 检测 JSPI、离屏画布、OPFS 同步文件句柄以及跨源隔离状态 | `checkPlatform / testFilesystem` | 启动前能力门禁 |
| [图形适配器试探器](../web/graphics.js) | 依次枚举核心、兼容与后备模式的 WebGPU 适配器并过滤软件设备 | `findGraphics / probeGraphics / adapterOptions` | 引擎启动前设备协商 |
| [自适应线程池策略](../web/thread-policy.js) | 根据核数、内存与即时并行微基准选择最省核而无掉速的 Worker 数量 | `chooseThreadPolicy / guestWorkerLimit / selectWorkerCount` | `web/engine.js` 启动前计算 |
| [引擎同域宿主桥](../web/engine.js) | 注入 Worker 参数、统筹 `uiSr`/`fsr1` 互斥并回退呈递软件帧与菜单事件 | `start / window.vitaPlayer / postMessage` | 被加载在同源内联框架中 |
| [同设备 AI 后处理](../web/frameflow-worker.js) | 请求 `shader-f16`、构建三槽 `GPUTexture` 环并运行 `GameFI` / `GameSR` | `PRESETS / SR_PRESETS / ensureRingAndSession` | Worker 模块最先导入 |

相关验证：`tests/thread-policy.test.mjs`、`tests/graphics.test.mjs` 离线验证选核策略与适配器过滤逻辑。

## `patches/`

以四段递增 Git diff 补丁保存对上游 `vitaslop` 源码的全部改造，不检入修改后的完整上游仓库文件，保证重编基准随时可核对。

| 重要代码 | 功能 | 关键符号 | 调用方 / 使用方 |
| --- | --- | --- | --- |
| [固件重定位与系统解码补丁](../patches/vitaslop-firmware.patch) | 修复解码器与系统模块重定位并补全基础 `libkernel` 与图形编码支持 | `load / decode / clib_strnlen` | `build_vitaslop.py` 首段应用 |
| [音视频控制与输入流补丁](../patches/vitaslop-playback.patch) | 调整游戏输入控制状态、`avplayer` 与 `iofilemgr` 文件读取流控 | `InputState / fill_ctrl / worker_input_key` | 补丁栈第二段 |
| [战斗场景唤醒修复补丁](../patches/vitaslop-battle.patch) | 修补 ARM 跳转表识别及协程等待内核线程信号唤醒导致的中断问题 | `state_threads.rs / lower.rs` | 补丁栈第三段 |
| [原生 FSR 1 双通道着色器](../patches/vitaslop-fsr1.patch) | 在 `vitaslop-web` 侧增加 `fsr1-easu` 与 `fsr1-rcas` 空间上采样渲染通道 | `Fsr1 / Fsr1::encode / fsr1.wgsl` | 补丁栈第四段与工作器渲染循环 |

相关验证：由 `scripts/build_vitaslop.py` 校验树状态递增合并并通过 `wasm-bindgen 0.2.126` 编译导出。

## `scripts/`

提供零手动介入的输入校验、增量编译、隔离头预览服务以及跨端对测数据汇编工具。

| 重要代码 | 功能 | 关键符号 | 调用方 / 使用方 |
| --- | --- | --- | --- |
| [锁定基线与输入准备](../scripts/prepare.py) | 还原静态归档内 93 个播放器文件，校验源安装包抽取出同份游戏与固件压缩包 | `players / inputs / sha` | 环境初始化阶段 |
| [核心补丁重编脚本](../scripts/build_vitaslop.py) | 临时无状态校验并打上四段补丁，生成同版固件 `libsas.suprx` 覆盖包 | `apply_stack / make_overlay / build` | 本地重编 Vitaslop Wasm |
| [隔离预览服务与本地启动接口](../scripts/serve.py) | 仅监听回环地址并提供 COOP/COEP 头，同源 POST 触发指定图形后端浏览器 | `Player / do_POST / do_GET` | 交互预览与自动化连接目标 |
| [图形后端启动规约](../scripts/edge_backends.py) | 定义五套驱动/ANGLE 切换参数组合并负责同源 JSON 启动校验 | `BACKENDS / find_browser / parse_open_edge_payload` | `serve.py` 与桌面启动脚本 |
| [跨端自动化运行器](../scripts/run.mjs) | 通过 Playwright 控制桌面或安卓环境，核对指纹、导入测试文件并记录结果 | `parseArgs / input / phase` | 冷启动及自动化对比测试 |
| [战斗交互脚本](../scripts/battle.mjs) | 通过命令文件逐帧推进序章、跳跃校准、600 秒采样与 FSR 无损对照 | `digest / fsrTrial` | `Battle Pentagram` 固定场景试跑 |
| [实测对照制表脚本](../scripts/report.py) | 读取 `cases.json` 与实测 JSON 并校验截图哈希，生成 `COMPARISON.md` | `battle_comparison / reviewed_picture` | 实验结果更新与复核 |

相关验证：通过 `node --test tests/probe.test.mjs` 验证探针与服务校验约束，`report.py` 强制核对所有引用截图的 SHA-256 指纹。

## `bench/`

负责渲染热路径的零干扰采样与通道画质抓图，保证测量信号独立于宿主浏览器合成流程。

| 重要代码 | 功能 | 关键符号 | 调用方 / 使用方 |
| --- | --- | --- | --- |
| [GPU 提交信号拦截器](../bench/worker-probe.js) | 跟踪写入主显示表面的命令提交并发送 `pvsspw-submit` 事件 | `surfaces / views / queue.submit` | `engine.html` / 运行器预注入 |
| [FSR 双通道同帧抓图与对照](../bench/fsr-passes.js) | 在测试会话挂接 `present-scale`、`fsr1-easu`、`fsr1-rcas` 输出并对比开关帧率 | `compareFsr` | `--battle` 与 `PV_FSR_COMPARE=1` 模式 |

相关验证：通过 `tests/probe.test.mjs` 离线验证探针提交通道识别分支。

## `tests/`

不依赖完整核心重编与真实镜像即可快速验证策略与接口行为，完整工作台端到端集成测试单独触发。

| 重要代码 | 功能 | 关键符号 | 调用方 / 使用方 |
| --- | --- | --- | --- |
| [策略与服务纯单测](../tests/thread-policy.test.mjs) | 测试选核逻辑、图形过滤与对测探针逻辑 | `tests/graphics.test.mjs / tests/probe.test.mjs` | 本地 `node --test tests/*.test.mjs` |
| [桌面工作台全流程检验](../tests/workbench.mjs) | 启动带 Intel Vulkan 参数的无头 Edge 验证界面启动、设置与运行流 | `workbench.mjs` | 构建后工作台验收 |

相关验证：全部纯 JS 策略和探针测试均可秒级离线运行。

## `results/`

存放经操作者核对过的结构化对比运行记录、首帧分析文字与带 SHA-256 校验的参照截图。

| 重要代码 | 功能 | 关键符号 | 调用方 / 使用方 |
| --- | --- | --- | --- |
| [设备与核心对比报告](../results/COMPARISON.md) | 汇总桌面无头浏览器与移动实机对比数据及 FSR 1 实验结果 | `desktop / battle / fsr-compare` | 由 `scripts/report.py` 刷新产出 |
| [对照索引与首帧记录](../results/cases.json) | 登记各组试次文件指向、截图摘要及桌面冷启动阶段统计 | `DESKTOP-FIRST-FRAME.md` | `report.py` 数据源 |

相关验证：`python3 scripts/report.py` 会核对索引所涉全部 PNG/JPG 截图的 SHA-256 摘要后才生成对比表。

## 覆盖范围

本代码地图范围涵盖仓库第一方界面外壳（`web/`）、补丁集（`patches/`）、准备与对测脚本（`scripts/`、`bench/`）及自动化回归入口（`tests/`）；`web/vendor/frameflow/` 具体内部网络与双端计算细节交由上游 `frameflow` 仓库维护与说明，`web/vendor/` 中源自 PPSSPW 衍生界面与第三方字体图标文件在根资产清单 `ASSETS_LICENSES.md` 中列明边界。

证据状态：除特别标注外，本页基于当前源码已确认。
