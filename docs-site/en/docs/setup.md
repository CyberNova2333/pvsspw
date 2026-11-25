# Setup, Rebuilding & Local Server

Requires Python 3.11+ (plus Node.js 22+ and `npm ci` for Playwright automation).

## 1. Restore Snapshots & Hash-Verify Local Inputs

```sh
# Verify & extract 93 locked comparison player files offline into .cache/pvsspw/players/
python3 scripts/prepare.py players

# Verify local archive SHA-256 and extract clean PCSG00214.zip + firmware.zip into .cache/pvsspw/inputs/
python3 scripts/prepare.py inputs --archive /path/to/TheBattlePentagram_JPN.zip
```

## 2. Rebuild Patched Vitaslop Wasm Cores

Building the single-threaded (`pkg/`) and multi-threaded (`pkg-threads/`) builds alongside the verified `vitaslop-sas.zip` (`libsas.suprx`) overlay requires pinned Rust tooling:

```sh
rustup toolchain install 1.98.0 --target wasm32-unknown-unknown --component rust-src
cargo +1.98.0 install --locked wasm-bindgen-cli --version 0.2.126
python3 scripts/build_vitaslop.py
```

## 3. Start Loopback COOP/COEP Preview Servers

Each core uses an isolated loopback origin to keep IndexedDB/OPFS saves separate (`18741`/`18747` for Vitaslop, `18742` for Vita3K Web):

```sh
python3 scripts/serve.py vitaslop --fixed --port 18747
python3 scripts/serve.py vita3k --port 18742
```

Mobile testing on Android can forward loopback ports over `adb reverse`, whereas iOS Safari requires HTTPS reverse proxies (with COOP/COEP headers) to obtain `crossOriginIsolated` and OPFS sync access handles.
