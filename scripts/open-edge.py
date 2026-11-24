#!/usr/bin/env python3
"""Open the local workbench in an isolated Linux Chromium/Edge profile with a chosen GPU backend."""
import argparse
import http.client
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

from edge_backends import (
    BACKENDS,
    DEFAULT_BACKEND,
    build_launch_env,
    find_browser,
    validate_backend_ready,
)

ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = 18747


def workbench_ready():
    connection = http.client.HTTPConnection(HOST, PORT, timeout=2)
    try:
        connection.request("GET", "/")
        response = connection.getresponse()
        if response.status != 200 or b'id="idleStartBtn"' not in response.read():
            raise SystemExit(f"{PORT} 端口上已有其他服务，请检查工作台服务。")
        return True
    except ConnectionRefusedError:
        return False
    finally:
        connection.close()


def start_service():
    if workbench_ready():
        return
    log = ROOT / ".cache/workbench-server.log"
    log.parent.mkdir(exist_ok=True)
    with log.open("ab") as output:
        service = subprocess.Popen(
            [sys.executable, "-u", str(ROOT / "scripts/serve.py"), "vitaslop", "--fixed", "--edge-launcher"],
            cwd=ROOT, stdin=subprocess.DEVNULL, stdout=output, stderr=output, start_new_session=True,
        )
    for _ in range(100):
        if workbench_ready():
            return
        if service.poll() is not None:
            break
        time.sleep(0.1)
    raise SystemExit(f"工作台服务启动失败，详情见 {log}")


def focus_game_window(profile):
    xdotool = shutil.which("xdotool")
    if not xdotool or not os.environ.get("DISPLAY"):
        return False
    try:
        hostname, _, pid = (profile / "SingletonLock").readlink().name.rpartition("-")
        if hostname != os.uname().nodename or not pid.isdigit():
            return False
        command = (Path("/proc") / pid / "cmdline").read_bytes()
        if os.fsencode(f"--user-data-dir={profile}") not in command:
            return False
        windows = subprocess.run(
            [xdotool, "search", "--all", "--pid", pid, "--name", "PVSSPW"],
            capture_output=True, text=True, timeout=2,
        ).stdout.splitlines()
        return bool(windows) and subprocess.run(
            [xdotool, "windowactivate", windows[-1]], capture_output=True, timeout=2,
        ).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("title", nargs="?", default="", help="可选：直接启动的 9 位游戏编号")
    parser.add_argument(
        "--backend", "-b",
        choices=tuple(BACKENDS),
        default=DEFAULT_BACKEND,
        help="图形后端预设（默认 webgpu）",
    )
    parser.add_argument(
        "--browser",
        choices=("auto", "edge", "chrome", "chromium"),
        default="auto",
        help="使用的浏览器内核",
    )
    args = parser.parse_args()
    if args.title and not re.fullmatch(r"[A-Z0-9]{9}", args.title):
        raise SystemExit("用法：python3 scripts/open-edge.py [--backend webgpu|vulkan|nvidia|opengl|software] [游戏编号]")
    err = validate_backend_ready(args.backend)
    if err:
        raise SystemExit(err)
    browser = find_browser(args.browser)
    if not browser or sys.platform != "linux":
        raise SystemExit("此启动器需要 Linux 桌面环境下的 Edge / Chrome / Chromium。")
    start_service()

    spec = BACKENDS[args.backend]
    data = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    profile = data / "pvsspw" / spec["profile_dir"]
    profile.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not args.title and focus_game_window(profile):
        return

    env = build_launch_env(args.backend)
    url = f"http://{HOST}:{PORT}/" + (f"#/play/{args.title}" if args.title else "")
    os.execve(browser, [
        browser, f"--user-data-dir={profile}",
        *spec["flags"],
        "--no-first-run", "--no-default-browser-check",
        f"--app={url}",
    ], env)


if __name__ == "__main__":
    main()
