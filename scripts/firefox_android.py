"""Run the same local fixture through Firefox Android's normal file picker via WebDriver."""
import argparse
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

from prepare import ROOT, CACHE, sha
from serve import PORTS


class Driver:
    def __init__(self, url):
        self.url = url.rstrip("/")
        self.session = ""

    def call(self, method, path, data=None):
        request = urllib.request.Request(self.url + self.session + path, method=method,
                                         data=json.dumps(data).encode() if data is not None else None,
                                         headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=95) as response:
                return json.load(response)["value"]
        except urllib.error.HTTPError as error:
            raise RuntimeError(json.load(error)["value"]["message"][:600]) from error

    def js(self, script, *args):
        return self.call("POST", "/execute/sync", {"script": script, "args": args})

    def wait(self, script, *args, seconds=60):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            result = self.js(script, *args)
            if result:
                return result
            time.sleep(0.35)
        raise TimeoutError("Timed out waiting for " + script[:130])

    def click(self, selector, label=""):
        self.wait("""const e=[...document.querySelectorAll(arguments[0])].find(
            e=>e.getClientRects().length && !e.disabled && (!arguments[1] || e.textContent.trim()===arguments[1]));
            if(e){e.click();return true} return false;""", selector, label)

    def file(self, selector, filename):
        self.wait("return !!document.querySelector(arguments[0])", selector)
        element = self.call("POST", "/element", {"using":"css selector", "value":selector})
        self.call("POST", "/element/" + element["element-6066-11e4-a52e-4f735466cecf"] + "/value",
                  {"text":"/data/local/tmp/pvsspw-bench/" + filename})


def run(args):
    device = args.serial
    def adb(*cmd):
        return subprocess.check_output(["adb", "-s", device, *cmd], text=True).strip()
    def prop(key):
        return adb("shell", "getprop", key)

    sample = json.loads((ROOT / "bench/sample.lock.json").read_text())
    engine = args.engine
    port = PORTS[engine]
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    if (out / "run.json").exists():
        raise ValueError("Choose a new output directory for this trial")
    required = ["PCSG00214.zip"] + (["firmware.zip"] if engine == "vita3k" else [])
    adb("shell", "mkdir", "-p", "/data/local/tmp/pvsspw-bench")
    for file in required:
        path = CACHE / "inputs" / file
        digest = sample[file]["sha256"]
        if sha(path) != digest:
            raise ValueError(f"Local hash mismatch: {file}")
        dest = "/data/local/tmp/pvsspw-bench/" + file
        adb("push", "--sync", str(path), dest)
        if adb("shell", "sha256sum", dest).split()[0] != digest:
            raise ValueError(f"Device hash mismatch: {file}")
    adb("reverse", f"tcp:{port}", f"tcp:{port}")
    virtual = prop("ro.kernel.qemu") == "1" or prop("ro.boot.qemu") == "1" or device.startswith("emulator-")
    result = {"time":datetime.now(timezone.utc).isoformat(), "engine":engine, "titleId":sample["titleId"],
              "revision":json.loads((ROOT / "bench/players.lock.json").read_text())[engine]["deploymentCommit"],
              "sampleSha256":sample["PCSG00214.zip"]["sha256"], "deviceClass":"android-emulator" if virtual else "android-adb-unverified",
              "environment":{"model":prop("ro.product.model"),"android":prop("ro.build.version.release"),
                             "abi":prop("ro.product.cpu.abi"),"qemu":virtual},
              "visual":"unverified","sustainedFps":None,"saveReload":"not-tested","phases":[], "bootSeconds":args.seconds}
    def phase(name):
        result["phases"].append({"name":name,"at":datetime.now(timezone.utc).isoformat()})
        print(engine, name, flush=True)
    d = Driver(args.webdriver)
    try:
        phase("open")
        info = d.call("POST","/session",{"capabilities":{"alwaysMatch":{"browserName":"firefox",
                       "moz:firefoxOptions":{"androidPackage":"org.mozilla.firefox","androidDeviceSerial":device}}}})
        d.session = "/session/" + info["sessionId"]
        result["browser"] = "Firefox " + info["capabilities"]["browserVersion"]
        d.call("POST", "/url", {"url":f"http://127.0.0.1:{port}/"})
        d.wait("return !!window.PVBench")
        initial = d.call("POST", "/execute/async", {"args": [], "script": """
            const done=arguments[arguments.length-1];
            (async()=>{const entries=[];
              for await (const key of (await navigator.storage.getDirectory()).keys()) entries.push(key);
              return entries;})().then(done,e=>done({error:String(e)}));"""})
        result["initialOpfsEntries"] = initial
        if not isinstance(initial, list) or any(key != ".probe" for key in initial):
            raise RuntimeError("A cold run needs a fresh, readable test profile on this origin.")
        result["capabilities"] = d.call("POST","/execute/async",{"args":[], "script":"""
            const done=arguments[arguments.length-1];(async()=>{
              const a=await navigator.gpu?.requestAdapter().catch(()=>null);
              return {ua:navigator.userAgent,gpu:a?{vendor:a.info?.vendor,architecture:a.info?.architecture}:null,
                isolated:crossOriginIsolated,jspi:typeof globalThis.WebAssembly?.Suspending==='function',
                wasmMemory64:!!globalThis.WebAssembly?.validate(Uint8Array.of(0,97,115,109,1,0,0,0,5,3,1,4,0)),
                opfs:!!navigator.storage?.getDirectory};
            })().then(done,e=>done({error:String(e)}));"""})
        if engine == "vitaslop":
            phase("import-game")
            d.click('a[href="#/import"]')
            d.click('[data-mode="zip"]')
            d.file("#f-zip", "PCSG00214.zip")
            d.wait("""return !!document.querySelector('#play, .card.error')""", seconds=240)
            error = d.js("return document.querySelector('.card.error')?.innerText")
            if error and not d.js("return !!document.querySelector('#play')"):
                raise RuntimeError(error)
            phase("play")
            if d.js("return document.querySelector('#play').disabled"):
                raise RuntimeError(error or "Play disabled: " + d.js("return [...document.querySelectorAll('.checks .fatal')].map(e=>e.innerText).join(' | ')"))
            d.click("#play")
        else:
            for firmware in [True, False]:
                phase("import-firmware" if firmware else "import-game")
                d.click("button","Import firmware" if firmware else "Import a game")
                d.file('[role="dialog"] input[type=file]',"firmware.zip" if firmware else "PCSG00214.zip")
                d.click('[role="dialog"] button',"Import")
                action = "Done" if firmware else "Play"
                d.wait("""return !!document.querySelector('[role=dialog] .bg-error-container') ||
                    [...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent.trim()===arguments[0])""",
                       action, seconds=240)
                error = d.js("return document.querySelector('[role=dialog] .bg-error-container')?.innerText")
                if error:
                    raise RuntimeError(error)
                if not firmware:
                    phase("play")
                d.click('[role="dialog"] button', action)
        end = time.monotonic() + args.seconds
        while time.monotonic() < end:
            result["probe"] = d.js("return PVBench.result()")
            if result["probe"]["fault"]:
                raise RuntimeError(result["probe"]["fault"])
            if engine == "vita3k" and d.js("return document.body.innerText.includes('The game could not start')"):
                raise RuntimeError(d.js("return document.body.innerText.slice(0,600)"))
            if result["probe"]["events"] and not (out / "first-observed.png").exists():
                (out / "first-observed.png").write_bytes(base64.b64decode(d.call("GET","/screenshot")))
            time.sleep(1)
        result["status"] = "frames-observed-scene-unverified" if result["probe"]["events"] else "no-frame-before-timeout"
    except Exception as error:
        result.update(status="blocked",reason=str(error)[:750])
    finally:
        if d.session:
            try:
                result["probe"] = d.js("return window.PVBench?.result()")
                result["visibleText"] = d.js("return document.body.innerText.slice(-1700)")
                (out / "final.png").write_bytes(base64.b64decode(d.call("GET","/screenshot")))
            except Exception as error:
                result["captureError"] = str(error)[:280]
            finally:
                try:
                    d.call("DELETE","")
                except Exception:
                    pass
        (out / "run.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
        print(result["status"], result.get("reason","")[:180], flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("engine", choices=PORTS)
    parser.add_argument("--serial",required=True)
    parser.add_argument("--webdriver", default="http://127.0.0.1:18744")
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--seconds",type=int,default=180)
    args = parser.parse_args()
    if args.seconds < 1:
        parser.error("--seconds must be positive")
    run(args)
