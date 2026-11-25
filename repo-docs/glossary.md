# 术语表

| 术语 | 项目里的意思 | 延伸阅读 |
| --- | --- | --- |
| `Vitaslop` | 本项目修改与对测的主 PS Vita WebAssembly/WebGPU 核心，上游代码遵循 MIT 许可并通过 `patches/` 递增补丁维护。 | [Vitaslop 补丁栈与自适应线程策略](modules/core-patching-and-smp.md) |
| `OPFS` / `testFilesystem` | 浏览器私有源文件系统；平台门禁通过启动专用探针工作线程检测是否具备同步访问句柄能力。 | [一次真实主流程](walkthroughs/one-real-run.md) |
| `JSPI` | WebAssembly JavaScript Promise Integration（检测 `WebAssembly.Suspending`），缺失时在平台门槛期标记为致命拦截项。 | [一次真实主流程](walkthroughs/one-real-run.md) |
| `storageLock` / `pvsspw-library` | 工作台外壳基于浏览器 Web Locks API 请求的即时互斥锁，避免多个同源标签页同时安装游戏或篡改存档造成损坏。 | [一次真实主流程](walkthroughs/one-real-run.md) |
| `window.Worker` | 宿主引擎桥接层覆写的全局工作线程构造函数，在拉起 `/worker.js` 前统一附加图形偏好、软件呈现开关与 `GameFI` / `GameSR` 查询参数。 | [一次真实主流程](walkthroughs/one-real-run.md) |
| `chooseThreadPolicy` | 启动前并行算力评估与选线程入口，按 `single` / `manual` / `game` / `measured` / `budget` 五种策略确定线程数量。 | [Vitaslop 补丁栈与自适应线程策略](modules/core-patching-and-smp.md) |
| `selectWorkerCount` | 并行微测速筛选函数，从测得的线程规模中选择吞吐达到峰值九折的最小工作线程数量，抑制跨线程争用。 | [Vitaslop 补丁栈与自适应线程策略](modules/core-patching-and-smp.md) |
| `guestWorkerLimit` | 根据硬件核心数减去宿主余量（2）并结合设备内存分档确定的客体线程池上限（2 至 6 之间）。 | [Vitaslop 补丁栈与自适应线程策略](modules/core-patching-and-smp.md) |
| `libsas.suprx` / `vitaslop-sas.zip` | 针对同版固件提取并严格校验 SHA-256 后单独打成重打补丁覆盖包的系统音频模块，确保构建产物不内嵌完整固件。 | [Vitaslop 补丁栈与自适应线程策略](modules/core-patching-and-smp.md) |
| `FSR 1` / `vitaslop-fsr1.patch` | 挂载在原生显示流程末尾的两通道空间放大与锐化补丁（`fsr1-easu` + `fsr1-rcas`），与开启 AI 超分互斥启用。 | [FSR 1 与 FrameFlow 同设备零拷贝管线](modules/frameflow-and-fsr1-pipeline.md) |
| `srActive` | 引擎输出协商布尔状态；开启 `GameSR` 2× 超分时置为真，从而在发送 `output-size` 消息时自动关闭原生 `fsr1` 开关。 | [一次真实主流程](walkthroughs/one-real-run.md) |
| `GameFI` / `GameSR` | 集成自 `frameflow` 仓库的神经网络光流插帧与二倍实时超分套件，在硬件模式下共享同逻辑 GPU 设备运行。 | [FSR 1 与 FrameFlow 同设备零拷贝管线](modules/frameflow-and-fsr1-pipeline.md) |
| `ensureRingAndSession` / `frameflow-ring-0..2` | 同设备零拷贝三槽游戏纹理环初始化逻辑，绕开跨设备拷贝并将客体纹理释放钩子置空以避免提前回收。 | [FSR 1 与 FrameFlow 同设备零拷贝管线](modules/frameflow-and-fsr1-pipeline.md) |
| `shader-f16` | 可选的半精度计算着色器特性，由后处理初始化拦截器在驱动支持且非软件渲染时透明附着给设备。 | [FSR 1 与 FrameFlow 同设备零拷贝管线](modules/frameflow-and-fsr1-pipeline.md) |
| `pvsspw-submit` | 由 GPU 命令提交探针在确认命令缓冲区写入全新游戏显示纹理后向宿主发出的精确呈现信号。 | [一次真实主流程](walkthroughs/one-real-run.md) |
| `battle.mjs` / `PCSG00214` | 针对日版《The Battle Pentagram》样本固定出生点的 600 秒交互与 FSR 无损对抗脚本；仅保留校验摘要与实测统计，仓库严禁分发任何镜像内容。 | [工作台存档、预览服务与自动对测](modules/benchmark-and-workbench.md) |
