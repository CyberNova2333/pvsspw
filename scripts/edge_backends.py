"""Shared graphics-backend launch specs for PVSSPW's local window launcher."""
import json
import os
from pathlib import Path
import re
import shutil

INTEL_ICD = Path("/usr/share/vulkan/icd.d/intel_icd.json")
NVIDIA_ICD = Path("/usr/share/vulkan/icd.d/nvidia_icd.json")
DEFAULT_BACKEND = "webgpu"
TITLE_ID_RE = re.compile(r"^[A-Z0-9]{9}$")

BACKENDS = {
    "webgpu": {
        "label": "WebGPU + GL 合成（Vulkan + Intel 核显）",
        "flags": ["--enable-features=Vulkan", "--use-angle=gl"],
        "icd": "intel-auto",
        "profile_dir": "edge-player",
    },
    "vulkan": {
        "label": "纯 Vulkan 后端（Vulkan + ANGLE Vulkan）",
        "flags": ["--enable-features=Vulkan", "--use-angle=vulkan"],
        "icd": "intel-auto",
        "profile_dir": "edge-vulkan",
    },
    "nvidia": {
        "label": "NVIDIA 独显后端（Vulkan + ANGLE Vulkan）",
        "flags": ["--enable-features=Vulkan", "--use-angle=vulkan"],
        "icd": "nvidia",
        "profile_dir": "edge-nvidia",
    },
    "opengl": {
        "label": "纯 OpenGL 后端（ANGLE GL）",
        "flags": ["--use-gl=angle", "--use-angle=gl"],
        "icd": None,
        "profile_dir": "edge-opengl",
    },
    "software": {
        "label": "软件渲染后端（SwiftShader）",
        "flags": ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-webgpu"],
        "icd": None,
        "profile_dir": "edge-software",
    },
}

BROWSER_CANDIDATES = {
    "edge": ("microsoft-edge", "microsoft-edge-stable"),
    "chrome": ("google-chrome",),
    "chromium": ("chromium", "chromium-browser"),
}


def find_browser(preferred="auto"):
    """Find an installed Chromium-family browser binary on Linux desktop."""
    order = (
        ("microsoft-edge", "microsoft-edge-stable", "google-chrome", "chromium", "chromium-browser")
        if preferred == "auto"
        else BROWSER_CANDIDATES.get(preferred, ())
    )
    for name in order:
        found = shutil.which(name)
        if found:
            return found
    return None


def has_intel_drm():
    return any(v.read_text().strip() == "0x8086" for v in Path("/sys/class/drm").glob("renderD*/device/vendor"))


def validate_backend_ready(backend):
    """Return an error string if the selected backend cannot run on this host, else None."""
    if backend not in BACKENDS:
        return f"不支持的后端：{backend}"
    icd_mode = BACKENDS[backend]["icd"]
    if icd_mode == "nvidia" and not NVIDIA_ICD.is_file():
        return f"未找到 NVIDIA Vulkan ICD（{NVIDIA_ICD}）"
    return None


def build_launch_env(backend, base_env=None):
    """Prepare isolated subprocess environment variables for a specific GPU backend."""
    env = dict(os.environ if base_env is None else base_env)
    icd_mode = BACKENDS[backend]["icd"]
    # Avoid leaking another backend's Vulkan ICD override into pure GL/SwiftShader windows.
    env.pop("VK_DRIVER_FILES", None)
    env.pop("VK_ICD_FILENAMES", None)
    if icd_mode == "nvidia":
        if NVIDIA_ICD.is_file():
            env["VK_DRIVER_FILES"] = str(NVIDIA_ICD)
    elif icd_mode == "intel-auto":
        if INTEL_ICD.is_file() and (has_intel_drm() or backend == "vulkan"):
            env["VK_DRIVER_FILES"] = str(INTEL_ICD)
    return env


def parse_open_edge_payload(raw_bytes, default_backend=DEFAULT_BACKEND):
    """Parse POST /__local/open-edge body (empty, legacy titleId, or JSON object)."""
    if not raw_bytes:
        return default_backend, ""
    text = raw_bytes.decode("utf-8", errors="strict").strip()
    if not text:
        return default_backend, ""
    if TITLE_ID_RE.fullmatch(text):
        return default_backend, text
    if not text.startswith("{"):
        raise ValueError("无效的请求负载")
    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise ValueError("请求格式必须为对象")
    backend = str(payload.get("backend") or default_backend).strip()
    title = str(payload.get("title") or "").strip()
    if backend not in BACKENDS:
        raise ValueError(f"不支持的图形后端：{backend}")
    if title and not TITLE_ID_RE.fullmatch(title):
        raise ValueError("无效的游戏编号")
    return backend, title
