# 《战斗的五芒星》首轮浏览器对测

日版 `PCSG00214` v01.00。两个播放器收到相同的 62 个游戏文件。输入 ZIP 的 SHA-256 为 `e99a19869e9c83a5fce6862286a3541a997ec6e5fecd336aa7ecc5d8b1d4fd88`。

## 桌面无头 Edge · 第一场可控战斗

Microsoft Edge 157.0.4341.57，Linux 桌面 Intel Xe-LPG 硬件 WebGPU。「わたしのはじまり」第一階層，目标为击败全部使魔。各轮均在出生点确认小圆原地起跳、落地，随后静置 600 秒。

此前修复版的两种模式都在载入战斗时中断。本表各组使用同一份追加补丁，修正 ARM 跳转表识别和协程等待内核线程信号时的唤醒。 [载入故障记录](runs/edge-pentagram-battle-baseline.json)

| Vitaslop 模式 | 实际画面 FPS | 中央区域 FPS | 提交次数/秒 | 重复画面占比 | 画面更新时间间隔 P95 | 此前系统提示至 OP 彩色画面 |
|---|---:|---:|---:|---:|---:|---|
| [单线程](frames/pentagram-battle/single-battle.jpg) | **20.78** | 20.78 | 20.78 | 0.0% | 103.9 ms | 5.2、3.4、4.9、3.2 秒 |
| [多线程 · 固定 3 个](frames/pentagram-battle/multi-battle.jpg) | **21.99** | 21.99 | 21.99 | 0.0% | 101.5 ms | 3.2、16.4 秒 |
| [多线程 · CPU 测速初选 6 个](frames/pentagram-battle/auto-battle.jpg) | **19.21** | 19.21 | 19.21 | 0.0% | 135.7 ms | 本轮未计时 |

工作台在手机和桌面均默认多线程。这台 Linux 桌面上，CPU 测速初选 6 个线程，本作的战斗实测为 19.21 FPS，画面更新间隔 P95 为 135.7 毫秒。固定 3 个线程测得 21.99 FPS 和 101.5 毫秒。因此与本作、浏览器和硬件配置匹配时默认采用 3 个，已在更新后的工作台核实实际启动 3 个游戏执行线程。其他设备按自身预算及并行 CPU 测速选取。每种配置各有一次完整采样。历史固定 3 线程组另有一次约 91 秒时浏览器连接中断，原因未确定，已排除。在桌面模拟浏览器分别报告 4、8 个逻辑处理器时，实际就绪的游戏执行线程分别为 2、4 个。Android 真机上的线程选择和持续帧率仍待验证。

实际画面 FPS 按游戏输出中 RGB 像素发生变化的帧数除以 600。中央区域取宽、高各一半，避开边缘 HUD。各组均按原生上限输出，实测纹理为 960×544。OP 等待时间沿用此前版本的逐次截图记录，起点为最后一个厂商标志之后的系统数据提示。 [固定模式战斗记录](runs/edge-pentagram-battle.json) · [OP 原始记录](runs/edge-pentagram-playback.json) · [自动线程启动核验与战斗记录](runs/edge-thread-policy.json)

| 每分钟实际画面 FPS | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 单线程 | 25.03 | 21.18 | 19.07 | 18.78 | 18.58 | 21.28 | 21.42 | 20.72 | 20.65 | 21.07 |
| 多线程 · 固定 3 个 | 23.60 | 24.32 | 22.32 | 18.83 | 21.60 | 22.15 | 22.22 | 20.80 | 22.77 | 21.28 |
| 多线程 · CPU 测速初选 6 个 | 25.93 | 19.42 | 16.85 | 17.77 | 19.53 | 15.75 | 16.53 | 18.83 | 20.80 | 20.65 |

## 桌面无头 Edge · FSR 1 空间超分对照（1440×816）

Microsoft Edge 157.0.4341.57，Linux 桌面 Intel Xe-LPG 硬件 WebGPU，固定 3 个游戏执行线程。同一份日版 `PCSG00214` 第一场可控战斗出生点，将原生 960×544 输出放大至 1440×816，先在单次 WebGPU 提交内采得同帧无损对比图，再经界面开关顺序静置采样各 600 秒。

| FSR 1 状态 | 输出分辨率 | 核验 GPU 通道（600 秒内） | 实际画面 FPS | 中央区域 FPS | 重复画面占比 | 画面更新时间间隔 P95 | 同帧无损原图 |
|---|---|---|---:|---:|---:|---:|---|
| [FSR 1 关（present-scale）](frames/pentagram-fsr/fsr-off-battle.jpg) | 1440×816 | present-scale 12917（FSR 0） | **21.45** | 21.45 | 0.0% | 129.5 ms | [1440×816 原图](frames/pentagram-fsr/fsr-off.png) |
| [FSR 1 开（EASU + RCAS）](frames/pentagram-fsr/fsr-on-battle.jpg) | 1440×816 | EASU 11228 / RCAS 11228（present-scale 0） | **18.64** | 18.64 | 0.0% | 149.1 ms | [1440×816 原图](frames/pentagram-fsr/fsr-on.png) |

在 1440×816 输出分辨率（960×544 放大 1.5 倍）、3 个游戏执行线程下，同帧无损对比显示 FSR 1（EASU 边缘定向放大 + RCAS 锐化）平滑了角色轮廓、头发与饰边的斜向像素阶梯，同时保持 2D 头像与日文技能文字边缘清晰，无明显振铃或色偏。600 秒实际画面帧率对照中，关闭组为 21.45 FPS（画面更新间隔 P95 129.5 毫秒），开启组为 18.64 FPS（P95 149.1 毫秒），总体低 2.81 FPS（-13.1%）。关闭组第 1 分钟在刚唤醒冷机状态下达到 30.00 FPS，第 2–10 分钟稳定在 19.78–22.00 FPS（均值 20.50 FPS）；紧随其后的开启组全程稳定在 18.15–20.08 FPS，与关闭组稳态相比约低 1.86 FPS（-9.1%）。两端均由 GPU 通道计数核验：关闭组仅运行 present-scale（12,917 次），开启组仅运行 fsr1-easu 与 fsr1-rcas（各 11,228 次）。此前一轮在修复不透明 Alpha 读回前、紧随编译高负载执行的试次（关 17.63 FPS / 开 21.08 FPS）未计入正式表。反向顺序（先开后关）复测与 Android 真机超分开销仍待验证。

[2× 同帧细节放大对比](frames/pentagram-fsr/fsr-zoom-compare.png) · [FSR 关原图](frames/pentagram-fsr/fsr-off.png) · [FSR 开原图](frames/pentagram-fsr/fsr-on.png) · [原始记录与逐分钟数据](runs/edge-pentagram-fsr1.json)

| 每分钟实际画面 FPS（1440×816） | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FSR 1 关（present-scale） | 30.00 | 22.00 | 20.65 | 20.83 | 20.87 | 20.23 | 19.93 | 20.37 | 19.87 | 19.78 |
| FSR 1 开（EASU + RCAS） | 18.83 | 19.20 | 20.08 | 18.68 | 18.27 | 18.38 | 18.18 | 18.15 | 18.35 | 18.30 |

## 其他场景与设备

| 设备与证据 | 核心 | 冷启动首个渲染提交 | 可辨识游戏画面 | 战斗场景持续 FPS（600 秒） | 游戏内存档 → 关闭页面 → 读回 | 实测观察 |
|---|---|---|---|---|---|---|
| [桌面 Edge 157 无头 · Intel Xe-LPG · 触摸模拟 · 游戏内方向键](runs/edge-pentagram-playback.json) | Vitaslop 工作台 | 已提交，触控试次未计时 | [已确认日文选项菜单及高亮行](frames/workbench-edge/pentagram-menu-low-fps.jpg) | 未采样 | 未验证 | 常速 8 次点按均逐项移动。人为限速至 12.21 次提交/秒后，180、310、450 毫秒各移动一项；「只单步」按住 1.25 秒也只走一项。默认模式按住 950 毫秒逐项连发，松手后停止。 |
| [Linux 桌面实机 · Edge 157 无头 · Intel Xe-LPG · 片头与输出分辨率](runs/edge-pentagram-playback.json) | Vitaslop 工作台 | 本轮按阶段取样 | [已确认 OP 彩色画面](frames/workbench-edge/pentagram-op.jpg) | 未采样 | 未验证 | 系统数据提示至 OP 出画，多线程两次为 3.2、16.4 秒；单线程四次为 5.2、3.4、4.9、3.2 秒（最后一次为发布版）。默认多线程仍有长等待。OP 源片 23.976 FPS，14.7 秒播放段测得 60.03 次画布提交/秒。 [过场取样](frames/workbench-edge/pentagram-boot-timing.jpg) |
| [Linux 桌面 · Edge 157 无头 · 默认参数](frames/workbench-edge/edge-no-gpu.png) | Vitaslop 工作台 | 无可用设备 | 无 | 未进入采样场景 | 未验证 | 标准、兼容和软件回退共 7 次请求均未取得适配器。已导入游戏的按钮可打开诊断并重试。 |
| [Linux 桌面实机 · Edge 独立游玩窗口 · Intel Xe-LPG](frames/workbench-edge/local-window.png) | Vitaslop 工作台 | 未计时 | 已确认 BANDAI NAMCO Games 片头 | 未采样 | 未验证 | 从无 WebGPU 的默认 Edge 点诊断页按钮，打开同机独立窗口。在浏览器等待声音授权时也能进入游戏，截图取自桌面上的游玩窗口。 |
| [Linux 桌面实机 · Edge 157 无头 · Intel Xe-LPG](frames/workbench-edge/game.png) | Vitaslop 工作台 | 已提交，未计时 | 已确认日文「ご注意」 | 未采样 | 未验证 | 从工作台导入同一份日版游戏及 rePatch，并经新详情、按键设置、暂停菜单和截图流程复测。 |
| [Linux 桌面 · Edge 157 无头 · SwiftShader 软件 WebGPU](frames/workbench-edge/software-game.png) | Vitaslop 工作台 | 已提交，未计时 | 已确认日文「ご注意」 | 未采样 | 未验证 | 独立测试配置显式开放软件设备，经用户确认启动。已核对页面合成画面和导出的游戏截图。 |
| [Linux 桌面实机 · Edge 157 无头 · Intel Xe-LPG · 修复版 A](runs/edge-vitaslop-final-first.json) | Vitaslop | 9196 ms（渲染提交） | [9.913 秒取样 · 日文注意事项](frames/edge-final-first/game-000042.png) | 无有效采样 | 未验证 | 35 秒冷启动取样。默认 GXP 着色器和 SMP 开启，第 1 次提交接近全黑，第 42 次提交的游戏纹理已能读到完整提示。 |
| [Linux 桌面实机 · Edge 157 无头 · Intel Xe-LPG · 修复版 B](runs/edge-vitaslop-final-intro.json) | Vitaslop | 8898 ms（渲染提交） | [已确认 · 日文注意事项（截图未单独计时）](frames/edge-final-intro/first-observed.png) | 无有效采样 | 未验证 | 155 秒复测。完整播放片头，140.597 秒已捕获带 PRESS START BUTTON 的[标题界面](frames/edge-final-intro/canvas-140340ms.png)。 |
| [Linux 桌面实机 · Edge 157 无头 · Intel Xe-LPG · 原版](runs/edge-vitaslop-original.json) | Vitaslop | 未观察到 | 未观察到 | 未进入采样场景 | 未验证 | 点 Play 后在第 0 帧复现 SceSas 的 0x180c6824。 |
| [Linux 桌面实机 · Edge 157 无头 · Intel Xe-LPG · 原版](runs/edge-vita3k-original.json) | Vita3K Web | 43733 ms（渲染提交） | 未确认 | 未进入采样场景 | 未验证 | 90 秒仅收到一次呈现信号，首张和最终截图相同，游戏区域为黑色。日志记录了信号量断言和不支持的 Dynarmic IR。[截图](frames/edge-vita3k/final.png) |
| Android 实体手机 · Edge · 修复版 | Vitaslop | 待实测 | 待实测 | 待实测 | 待实测 | 2026-11-22 确认当前无实体手机，真机试次未开始。日版 PCSG00214、固件覆盖包和修复版 Wasm 指纹已与桌面实测记录核对。 |
| [桌面 Edge 157 · 横屏触摸模拟](runs/edge-vitaslop-final-touch.json) | Vitaslop | 9285 ms（渲染提交） | [10.335 秒取样 · 日文提示和虚拟手柄](frames/edge-final-touch/first-observed.png) | 无有效采样 | 未验证 | 844×390、DPR 2，在桌面 Edge 中轻触 Play。图形设备仍为主机 Intel GPU。 |
| [Android 14 虚拟机 · x86_64 · Firefox 160.0.1 · SwiftShader](runs/android-vitaslop.json) | Vitaslop | 未启动 | 未观察到 | 未进入采样场景 | 未验证 | 已导入并识别 PCSG00214。此浏览器配置未提供 WebGPU，播放器禁用 Play。 |
| [Android 14 虚拟机 · x86_64 · Firefox 160.0.1 · SwiftShader](runs/android-vita3k.json) | Vita3K Web | 未观察到 | 未观察到 | 未进入采样场景 | 未验证 | 固件和游戏已导入。点 Play 后播放器报告缺少 navigator.gpu，180 秒观察期内没有提交游戏帧。 |
| [Linux 桌面 · Chromium 158 · Intel Xe-LPG](runs/desktop-vitaslop.json) | Vitaslop | 未观察到 | 未观察到 | 未进入采样场景 | 未验证 | 游戏已导入。第 0 帧报告未实现的系统函数 NID 0x180c6824，核心停止。 |
| [Linux 桌面 · Chromium 158 · Intel Xe-LPG](runs/desktop-vita3k.json) | Vita3K Web | 未观察到 | 未观察到 | 未进入采样场景 | 未验证 | 固件和游戏已导入，AOT 编译用时 11.2 秒。180 秒内无游戏帧，日志记录了信号量断言和 Wasm JIT 不支持的 Dynarmic IR。 |
| Android 实体手机 · 待验证 | Vita3K Web | 待实测 | 待实测 | 待实测 | 待实测 | 本轮没有接入实体 Android 手机。 |
| iPhone 实机 · Safari · 待验证 | Vitaslop | 待实测 | 待实测 | 待实测 | 待实测 | 本轮没有接入 iPhone。 |
| iPhone 实机 · Safari · 待验证 | Vita3K Web | 待实测 | 待实测 | 待实测 | 待实测 | 本轮没有接入 iPhone。 |

首帧计时从 Play 开始。“取样”表示该时刻采得的截图已经人工核对，画面可能更早出现。持续 FPS 仅使用已确认画面的有效 600 秒采样。存读档需同一试次的写档与重开读回两份证据。虚拟机结果仅代表所列客体、浏览器和图形配置。
