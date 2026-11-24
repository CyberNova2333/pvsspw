"""Build the firmware-capable player from the pinned upstream and the local source patches."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from prepare import CACHE, ROOT, sha

UPSTREAM = json.loads((ROOT / "bench/players.lock.json").read_text())["vitaslop"]
PATCH = ROOT / "patches/vitaslop-firmware.patch"
PLAYBACK = ROOT / "patches/vitaslop-playback.patch"
BATTLE = ROOT / "patches/vitaslop-battle.patch"
FSR1 = ROOT / "patches/vitaslop-fsr1.patch"
PLAYER_PATCHES = [PATCH, PLAYBACK, BATTLE, FSR1]
SOURCE = ROOT / ".cache/vitaslop-src"
BUILD = CACHE / "builds/vitaslop"
MODULE = "vs0/sys/external/libsas.suprx"
MODULE_SHA = "f6a626a7851d0e63b5c6de23f048f1ae4855dbcd46842193d35a29c3e63b4372"


def make_overlay():
    folder = CACHE / "inputs"
    lock = json.loads((ROOT / "bench/sample.lock.json").read_text())
    if sha(folder / "firmware.zip") != lock["firmware.zip"]["sha256"]:
        raise ValueError("Prepare the locked firmware.zip first")
    with zipfile.ZipFile(folder / "firmware.zip") as fw:
        module = fw.read(MODULE)
    if hashlib.sha256(module).hexdigest() != MODULE_SHA:
        raise ValueError("Unexpected libsas.suprx")
    title = lock["titleId"]
    overlay = folder / "vitaslop-sas.zip"
    info = zipfile.ZipInfo(f"rePatch/{title}/sce_module/libsas.suprx")
    info.create_system = 3
    info.external_attr = 0o600 << 16
    with tempfile.TemporaryDirectory(dir=folder) as scratch:
        tmp = Path(scratch) / overlay.name
        with zipfile.ZipFile(tmp, "w") as out:
            out.writestr(info, module)
        tmp.replace(overlay)
    return overlay


def apply_stack(git, patches):
    # Two patches touch lower.rs. Compare entire tree states, including retries
    # after any complete prefix, without using or altering the checkout's index.
    with tempfile.TemporaryDirectory() as scratch:
        env = dict(os.environ, GIT_INDEX_FILE=str(Path(scratch) / "index"))
        subprocess.run([*git, "read-tree", "HEAD"], env=env, check=True)
        trees = ["HEAD"]
        for patch in patches:
            subprocess.run([*git, "apply", "--cached", str(patch)], env=env, check=True)
            trees.append(subprocess.check_output([*git, "write-tree"], env=env, text=True).strip())
        for i in reversed(range(len(trees))):
            # Compare added shader files too, without staging them in the user's checkout.
            subprocess.run([*git, "read-tree", trees[i]], env=env, check=True)
            if subprocess.run([*git, "diff", "--quiet", trees[i], "--"], env=env).returncode == 0:
                for patch in patches[i:]:
                    subprocess.run([*git, "apply", str(patch)], check=True)
                return
        raise ValueError("Source checkout has changes outside the selected patch stack")


def build(battle=False):
    if not SOURCE.exists():
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=SOURCE.parent) as scratch:
            checkout = Path(scratch) / "source"
            subprocess.run(["git", "init", "-q", str(checkout)], check=True)
            git = ["git", "-C", str(checkout)]
            subprocess.run([*git, "fetch", "--depth=1", "https://github.com/cretz/vitaslop.git",
                            UPSTREAM["deploymentCommit"]], check=True)
            subprocess.run([*git, "checkout", "--detach", "FETCH_HEAD"], check=True)
            checkout.rename(SOURCE)
    git = ["git", "-C", str(SOURCE)]
    if subprocess.check_output([*git, "rev-parse", "HEAD"], text=True).strip() != UPSTREAM["deploymentCommit"]:
        raise ValueError("Wrong upstream revision in " + str(SOURCE))
    apply_stack(git, PLAYER_PATCHES)
    toolchain = "1.98.0"
    env = dict(os.environ, RUSTUP_TOOLCHAIN=toolchain)
    for key, tool in [("RUSTC", "rustc"), ("RUSTDOC", "rustdoc")]:
        env[key] = subprocess.check_output(["rustup", "which", "--toolchain", toolchain, tool], text=True).strip()
    env["PATH"] = str(Path(env["RUSTC"]).parent) + os.pathsep + env["PATH"]
    if subprocess.check_output(["wasm-bindgen", "--version"], text=True).strip() != "wasm-bindgen 0.2.126":
        raise ValueError("Use wasm-bindgen-cli 0.2.126")
    web = SOURCE / "projects/vitaslop-web"
    node = subprocess.check_output(["node", "-p", "process.execPath"], text=True).strip()
    subprocess.run([node, "build.mjs"], cwd=web, env=env, check=True)
    publish(battle)


def publish(battle=False):
    revision = "+".join([UPSTREAM["deploymentCommit"], *(sha(p) for p in PLAYER_PATCHES)])
    files = {}
    web = SOURCE / "projects/vitaslop-web/web"
    for name, expected in UPSTREAM["files"].items():
        if name.startswith(("pkg/", "pkg-threads/")):
            continue
        original = CACHE / "players/vitaslop" / name
        if sha(original) != expected:
            raise ValueError("Restore the locked baseline first: " + name)
        dst = BUILD / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(web / name if name == "worker.js" else original, dst)
        files[name] = sha(dst)
    for pkg in ("pkg", "pkg-threads"):
        if not (web / pkg / "vitaslop_web_bg.wasm").is_file():
            raise ValueError("Build missing: " + pkg)
        for file in sorted((web / pkg).rglob("*")):
            if not file.is_file() or file.suffix not in (".js", ".wasm", ".txt"):
                continue
            name = file.relative_to(web).as_posix()
            dst = BUILD / name
            dst.parent.mkdir(parents=True, exist_ok=True)
            if file.name == "build-stamp.txt":
                dst.write_text(f"{pkg} {revision}\n")
            else:
                shutil.copyfile(file, dst)
            files[name] = sha(dst)
    manifest = {"deploymentCommit": revision, "files": files, "firmwareModuleSha256": MODULE_SHA,
                "overlaySha256": sha(make_overlay()), "directionSteps": True, "fsr1": True}
    with tempfile.NamedTemporaryFile(mode="w", dir=BUILD, delete=False) as tmp:
        tmp.write(json.dumps(manifest, indent=2) + "\n")
    Path(tmp.name).replace(BUILD / "manifest.json")
    print("Built", revision)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--battle", action="store_true", help="build the battle trial in a separate checkout")
    args = parser.parse_args()
    if args.battle:
        SOURCE = ROOT / ".cache/vitaslop-battle-src"
        BUILD = CACHE / "builds/vitaslop-battle"
    build(args.battle)
