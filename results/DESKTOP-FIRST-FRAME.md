# 《战斗的五芒星》桌面 WebGPU 首帧

2026-11-22，日版 PCSG00214 v01.00 在 Linux x86_64 的无头 Microsoft Edge 157.0.4341.57 上启动成功。Playwright 使用 `channel: 'msedge'`。WebGPU 适配器报告 `intel / xe-lpg`、`isFallbackAdapter: false`。每次冷启动都新建浏览器配置，检查 OPFS 没有已安装游戏或存档，再用界面导入相同的 62 个游戏文件。初始 OPFS 可能含播放器的能力检测目录 `.probe`。系统 GPU 驱动缓存沿用本机状态。计时从点 Play 开始，游戏导入时间另记。[输入指纹](../bench/sample.lock.json) · [设备与核心对比表](COMPARISON.md)

## 图像证据

首轮的首次渲染提交在 **9.196 秒**。第 1 次提交的纹理接近全黑；第 42 次提交已能读到游戏自己的日文注意事项，对应 **9.913 秒**。探针每隔约 700 毫秒取样，因此 9.913 秒是已经看得到内容的时间上界。第 85 次提交时注意事项已完全淡入。第二次冷启动在 8.898 秒首次提交，由浏览器截图，同样看到日文提示，随后出现 ARTDINK 标志和角色片头，140.597 秒时的截图显示五名角色和 “PRESS START BUTTON” 标题界面。[第 1 次提交](frames/edge-final-first/game-000001.png) · [第 42 次提交](frames/edge-final-first/game-000042.png) · [第 85 次提交](frames/edge-final-first/game-000085.png) · [第二次冷启动的日文提示](frames/edge-final-intro/first-observed.png) · [角色片头](frames/edge-final-intro/canvas-76441ms.png) · [片名](frames/edge-final-intro/canvas-130093ms.png) · [标题界面原图](frames/edge-final-intro/canvas-140340ms.png)

原始 JSON 保留自动采集时的 `pictureConfirmed: false`。事后核对的 PNG 单独登记在 `cases.json` 的 `review` 中；生成对比表时校验图片 SHA-256，并用该试次的取样时间计算表内秒数。[原始记录 A](runs/edge-vitaslop-final-first.json) · [原始记录 B](runs/edge-vitaslop-final-intro.json) · [截图审核记录](cases.json)

## 从第 0 帧到游戏画面

| 现场 | 定位与修复 |
|---|---|
| 原版在 frame 0 报告 `lib=0xee47ec43 nid=0x180c6824` | 对应 `SceSas.sceSasGetNeededMemorySize`。从样例附带的固件提取 `vs0/sys/external/libsas.suprx`，通过播放器的 rePatch 导入原模块，游戏 ZIP 保持同一 SHA-256。 |
| 导入模块时出现 `UnknownRelocFormat(3, 12)` | 补齐加载器对压缩重定位格式 2–9 的处理。用实际固件模块解析出 480 个重定位项，重定位后能找到所需的 SceSas 导出。 |
| 模块调用内核字符串函数和定点转换时停止 | 实现 `sceClibStrlcpy` 和 `sceClibStrlcat`，把 `sceNgsVoiceDefGetPauserBuss` 接入已有的 NGS 定义分发。修复 ARM/Thumb 标量定点 VCVT 的小数位数处理，覆盖模块实际执行的 `vcvt.s32.f32 s15, s15, #30`。 |
| 解决 CPU 错误后，默认着色器路径仍然没有画面 | 这块 Intel GPU 同时提供 BC 与 ETC2，渲染器优先选 BC，启动时仍预编译了 ETC2 链编码器。将该编码器在双格式设备上延迟到首次使用后，默认 GXP 着色器即可出图。正式试次的有效配置含 `VITASLOP_GXP_LIVE=1` 和 `VITASLOP_SMP=1`。 |

原版同机复现了第 0 帧的错误。排查中使用临时的固定功能渲染路径也看到了注意事项和片头。正式结果使用默认 GXP 路径。Vita3K Web 的同机对照在 43.733 秒报告一次呈现，90 秒内保留的两张截图相同，游戏区域全黑。其日志记录了信号量断言和 Dynarmic IR 不支持的指令。[原版 Vitaslop](runs/edge-vitaslop-original.json) · [默认 GXP 修复前的超时](runs/edge-vitaslop-default-gxp.json) · [临时固定功能路径的原始记录](runs/edge-vitaslop-repeat.json) · [临时路径的日文注意画面](frames/edge-repeat/game-000050.png) · [Vita3K Web](runs/edge-vita3k-original.json) · [VitaSDK 导出表](https://github.com/vitasdk/vita-headers/blob/c00157c2abd6dfa05c126e7f2f4efb29e8431ba6/db/360/SceSas.yml#L18)

## 复现与适用范围

[README 中的构建和无头 Edge 命令](../README.md#在桌面-edge-复现修复版)使用上游提交 `a6bd7788c9205ab9208f1970bc2de8e49e3ccd2e` 和本仓库的源码补丁。补丁 SHA-256 为 `8fa6cd62f5e0e79ab07cdb95fad0761b91f450ef87ccef1e9b0486074bd322c8`，本次多线程 Wasm 的 SHA-256 为 `8e9a469821a09d6eaa821e4ffb0c4046de5aa5d020542770aa972ed272818f8f`。加载器、运行时和转译器共通过 784 项 Rust 测试，运行时有 13 项标为忽略，测量探针的 3 项测试通过。[源码补丁](../patches/vitaslop-firmware.patch) · [构建脚本](../scripts/build_vitaslop.py)

另用同一无头 Edge 模拟 844×390 横屏触摸，轻触 Play 后 10.335 秒的截图同时显示日文提示、摇杆和按键。该试次使用桌面 Intel GPU。实体 Android 和 iPhone 尚未接入。战斗场景 600 秒持续帧率以及存档后重开读回均待验证。[触摸截图](frames/edge-final-touch/first-observed.png) · [触摸试次原始记录](runs/edge-vitaslop-final-touch.json)
