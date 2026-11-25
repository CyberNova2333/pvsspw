# 输入准备、重编与回环服务

本页整理自 `scripts/prepare.py`、`scripts/build_vitaslop.py`、`scripts/serve.py` 与 `scripts/edge_backends.py`。

## 1. 离线还原快照与校对局部样例输入

需要 Python 3.11+（无头桌面或移动自动化测试额外需 Node.js 22+ 与 `npm ci`）：

```sh
# 离线校验 SHA-256 并解压 bench/runtime/players.tar.gz 内 93 个播放器文件
python3 scripts/prepare.py players

# 核对本机合法日版样例压缩包哈希并提取最小 PCSG00214.zip 与 firmware.zip 到 .cache/pvsspw/inputs/
python3 scripts/prepare.py inputs --archive /path/to/TheBattlePentagram_JPN.zip
```

## 2. 四段源码补丁重编与独立 `libsas` 覆盖包

本地重新生成单线程 `pkg/` 与多线程 `pkg-threads/` Wasm 核心需安装锁定的 Rust 工具链与 `wasm-bindgen-cli`：

```sh
rustup toolchain install 1.98.0 --target wasm32-unknown-unknown --component rust-src
cargo +1.98.0 install --locked wasm-bindgen-cli --version 0.2.126
python3 scripts/build_vitaslop.py
```

`make_overlay()` 会提取固件内同版本 `libsas.suprx`、核对 SHA-256 并另行生成 `vitaslop-sas.zip` 覆盖包，确保编译产物目录不夹带完整系统固件。

## 3. 回环服务端口隔离与移动端访问前提

不同核心绑定彼此独立的回环端口，由浏览器同源策略隔离 IndexedDB / OPFS 存储：

- `python3 scripts/serve.py vitaslop`（默认 `18741`；加 `--fixed` 常用 `18747`）
- `python3 scripts/serve.py vita3k`（默认 `18742`）
- Android 可用 `adb reverse` 映射回环端口；iPhone Safari 除回环外需配置带 `COOP`/`COEP` 响应头的局域网 HTTPS 反向代理。
