# 准备、重编与本地服务

本页总结自仓库配置、构建与预览脚本（`scripts/prepare.py`、`scripts/build_vitaslop.py`、`scripts/serve.py`），展示如何从零准备离线对照核心并启动安全预览站点。

## 1. 还原对照基线与准备测试样本

需要 Python 3.11+（桌面与移动自动化测试需额外安装 Node.js 22+ 与 `npm ci`）：

```sh
# 离线校验并解压 93 个静态对照播放器文件至 .cache/pvsspw/players/
python3 scripts/prepare.py players

# 对本机自备合法日版样例压缩包校验 SHA-256 并提取最小输入包 PCSG00214.zip 与 firmware.zip
python3 scripts/prepare.py inputs --archive /path/to/TheBattlePentagram_JPN.zip
```

## 2. 应用四段补丁重编 Vitaslop Wasm

当本地需要构建或复现含 `libsas` 覆盖包及 `FSR 1` 补丁的修复版核心时，需安装锁定的 Rust 工具链与 `wasm-bindgen-cli`：

```sh
rustup toolchain install 1.98.0 --target wasm32-unknown-unknown --component rust-src
cargo +1.98.0 install --locked wasm-bindgen-cli --version 0.2.126
python3 scripts/build_vitaslop.py
```

`build_vitaslop.py` 会核对同版固件内的 `libsas.suprx` 摘要并写出独立的 `vitaslop-sas.zip` 覆盖包（不内置完整固件文件），再把单线程与多线程核心产物输出至 `.cache/pvsspw/builds/vitaslop/`。

## 3. 启动独立回环服务与多端测试

不同播放器绑定不同固定回环端口（Vitaslop 默认 `18741`、`--fixed` 端口通常用 `18747`；Vita3K Web 使用 `18742`），从浏览器的同源策略层面严格隔离两套核心的游戏库与存档区：

```sh
python3 scripts/serve.py vitaslop --fixed --port 18747
python3 scripts/serve.py vita3k --port 18742
```

在安装有 Microsoft Edge 的桌面端或通过 ADB 端口转发连接的安卓设备上，即可运行 `scripts/run.mjs` 或 `tests/workbench.mjs` 执行冷启动与工作台验收。
