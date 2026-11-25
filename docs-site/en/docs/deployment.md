# Setup, Rebuilding & Loopback Server

Requires Python 3.11+ (plus Node.js 22+ and `npm ci` for Playwright automation).

## 1. Restore Baseline Snapshots & Extract Verified Inputs

```sh
# Extract & SHA-256 verify 93 baseline files from bench/runtime/players.tar.gz
python3 scripts/prepare.py players

# Verify local source archive hash and extract minimal PCSG00214.zip + firmware.zip
python3 scripts/prepare.py inputs --archive /path/to/TheBattlePentagram_JPN.zip
```

## 2. Rebuild Patched Single & Multi-Threaded Vitaslop Wasm

```sh
rustup toolchain install 1.98.0 --target wasm32-unknown-unknown --component rust-src
cargo +1.98.0 install --locked wasm-bindgen-cli --version 0.2.126
python3 scripts/build_vitaslop.py
```

`build_vitaslop.py` verifies a clean git prefix stack via `apply_stack()` before compiling `pkg/` + `pkg-threads/` and generating the standalone `vitaslop-sas.zip` (`libsas.suprx` SHA-256 verified) overlay.

## 3. Isolated Loopback Preview & Mobile Access

- Vitaslop listens on `127.0.0.1:18741` (or `--fixed --port 18747`); Vita3K Web uses `127.0.0.1:18742` so OPFS saves remain origin-isolated.
- Android testing forwards loopback ports over `adb reverse`, whereas LAN iPhone Safari testing requires HTTPS reverse proxies preserving COOP/COEP headers for secure-context OPFS sync handles.
