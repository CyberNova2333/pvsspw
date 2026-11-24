"""Render the checked-in comparison from the selected, device-labelled trials."""
import json
import re
from urllib.parse import parse_qs, urlsplit
from prepare import ROOT, sha


def json_file(path):
    return json.loads(path.read_text())


def cell(text):
    return str(text).replace("|", "／").replace("\n", " ")


def reviewed_picture(results, run, review):
    path = results / review["image"]
    if sha(path) != review["sha256"]:
        raise ValueError("Reviewed screenshot fingerprint mismatch: " + str(path))
    if path.name.startswith("game-"):
        capture = next(c for c in run["gameCaptures"] if c["file"] == path.name)
        elapsed = round(capture["time"] - run["probe"]["started"])
    elif path.name == "first-observed.png":
        captured = run.get("firstObservedCapture")
        if not captured:
            return f"[已确认 · {review['scene']}（截图未单独计时）]({review['image']})"
        elapsed = captured["capturedMs"]
    elif "screenCaptures" in run:
        elapsed = next(c["capturedMs"] for c in run["screenCaptures"] if c["file"] == path.name)
    else:
        elapsed = int(re.fullmatch(r"canvas-(\d+)ms\.png", path.name).group(1))
    return f"[{elapsed / 1000:.3f} 秒取样 · {review['scene']}]({review['image']})"


def battle_comparison(results, record, sample, policy_record=None):
    run = json_file(results / record)
    if (run["sampleSha256"] != sample["PCSG00214.zip"]["sha256"]
            or run["scene"] != "PCSG00214-first-battle-idle-v1" or run["deviceClass"] != "desktop"
            or run["channel"] != "msedge" or not run["headless"]):
        raise ValueError("Wrong battle fixture, scene or browser")
    arms = dict(run["arms"])
    labels = {"single": "单线程", "multi": "多线程 · 固定 3 个"}
    assessment = run["assessment"]
    evidence = [f'[固定模式战斗记录]({record})', f'[OP 原始记录]({run["opEvidence"]})']
    if policy_record:
        policy = json_file(results / policy_record)
        if any(policy[k] != run[k] for k in ("titleId", "sampleSha256", "scene", "deviceClass")):
            raise ValueError("Thread policy run used a different fixture")
        auto = policy["battle"]
        if not 2 <= auto["guestWorkers"] <= 6 or auto["wasmSha256"] != arms["multi"]["wasmSha256"]:
            raise ValueError("Unexpected automatic guest pool or core binary")
        arms["auto"] = auto
        labels["auto"] = f'多线程 · CPU 测速初选 {auto["guestWorkers"]} 个'
        assessment = policy["assessment"]
        evidence.append(f'[自动线程启动核验与战斗记录]({policy_record})')
    boot = json_file(results / run["opEvidence"])["bootTiming"]
    waits = {
        "single": [r["panelToOpMs"] for r in boot["singleWorkerRuns"]],
        "multi": [r["panelToOpMs"] for r in boot["runs"] if r["arm"] == "fixed-build-boot-tuning-disabled"],
    }
    lines = ["## 桌面无头 Edge · 第一场可控战斗", "",
             f'{run["browser"]}，{run["adapter"]}。'
             '「わたしのはじまり」第一階層，目标为击败全部使魔。各轮均在出生点确认小圆原地起跳、落地，随后静置 600 秒。',
             "",
             "此前修复版的两种模式都在载入战斗时中断。本表各组使用同一份追加补丁，修正 ARM 跳转表识别和协程等待内核线程信号时的唤醒。"
             f' [载入故障记录]({run["baselineEvidence"]})',
             "", "| Vitaslop 模式 | 实际画面 FPS | 中央区域 FPS | 提交次数/秒 | 重复画面占比 | 画面更新时间间隔 P95 | 此前系统提示至 OP 彩色画面 |",
             "|---|---:|---:|---:|---:|---:|---|"]
    previous = None
    for mode, label in labels.items():
        arm = arms[mode]
        if previous and (any(arm[k] != previous[k] for k in ("browserVersion", "revision", "gpu", "surface", "overlaySha256"))
                         or any(arm["measurement"][k] != previous["measurement"][k] for k in ("width", "height", "format"))
                         or previous["measurement"]["startEpochMs"] + 600000 > arm["measurement"]["startEpochMs"]):
            raise ValueError("Battle runs must use matching conditions in non-overlapping windows")
        previous = arm
        m = arm["measurement"]
        threaded_worker = parse_qs(urlsplit(arm["worker"]).query).get("smp") == ["1"]
        if (arm["sampleSha256"] != run["sampleSha256"]
                or arm["controlVerified"] is not True or arm["sceneReviewed"] is not True
                or arm["smp"] != int(mode != "single") or threaded_worker != (mode != "single")
                or m["status"] != "complete"
                or m["seconds"] != 600 or len(m["minutes"]) != 10
                or m["submissions"] <= 0 or m["duplicates"] + m["changed"] != m["submissions"]
                or not 0 < m["centerChanged"] <= m["changed"] <= m["submissions"]
                or any(sum(b[k] for b in m["minutes"]) != m[k] for k in ("submissions", "changed", "centerChanged"))):
            raise ValueError("Incomplete or inconsistent battle observation: " + mode)
        if sha(results / arm["evidence"]) != arm["evidenceSha256"]:
            raise ValueError("Reviewed battle images have changed: " + mode)
        op = "、".join(f"{ms / 1000:.1f}" for ms in waits[mode]) + " 秒" if mode in waits else "本轮未计时"
        lines.append(f'| [{label}]({arm["evidence"]}) | **{m["changed"]/600:.2f}** | '
                     f'{m["centerChanged"]/600:.2f} | {m["submissions"]/600:.2f} | '
                     f'{100*m["duplicates"]/m["submissions"]:.1f}% | {m["p95ChangeGapMs"]:.1f} ms | {op} |')
    lines.extend(["", assessment, "",
                  "实际画面 FPS 按游戏输出中 RGB 像素发生变化的帧数除以 600。中央区域取宽、高各一半，避开边缘 HUD。"
                  f'各组均按原生上限输出，实测纹理为 {run["arms"]["single"]["measurement"]["width"]}×'
                  f'{run["arms"]["single"]["measurement"]["height"]}。'
                  "OP 等待时间沿用此前版本的逐次截图记录，起点为最后一个厂商标志之后的系统数据提示。"
                  + ' ' + ' · '.join(evidence),
                  "", "| 每分钟实际画面 FPS | " + " | ".join(str(i) for i in range(1, 11)) + " |",
                  "|---|" + "---:|" * 10])
    for mode, label in labels.items():
        minutes = arms[mode]["measurement"]["minutes"]
        lines.append("| " + label + " | " + " | ".join(f'{b["changed"]/60:.2f}' for b in minutes) + " |")
    return lines


def fsr_comparison(results, record, sample):
    run = json_file(results / record)
    if (run["sampleSha256"] != sample["PCSG00214.zip"]["sha256"]
            or run["scene"] != "PCSG00214-first-battle-idle-v1" or run["deviceClass"] != "desktop"
            or run["channel"] != "msedge" or not run["headless"]):
        raise ValueError("Wrong FSR fixture, scene or browser")
    sf = run["sameFrameEvidence"]
    for img_key, sha_key in (("offImage", "offSha256"), ("onImage", "onSha256"), ("zoomImage", "zoomSha256")):
        if sha(results / sf[img_key]) != sf[sha_key]:
            raise ValueError("Reviewed FSR same-frame image changed: " + sf[img_key])
    arms = run["arms"]
    off, on = arms["off"], arms["on"]
    if (any(off[k] != on[k] for k in ("browserVersion", "revision", "gpu", "surface", "overlaySha256", "wasmSha256", "guestWorkers"))
            or any(off["measurement"][k] != on["measurement"][k] for k in ("width", "height", "format"))
            or off["measurement"]["width"] < 960 or off["measurement"]["height"] < 544
            or off["measurement"]["width"] * off["measurement"]["height"] <= 960 * 544
            or off["measurement"]["startEpochMs"] + 600000 > on["measurement"]["startEpochMs"]):
        raise ValueError("FSR arms must use matching upscaled conditions in non-overlapping windows")
    out_w, out_h = off["measurement"]["width"], off["measurement"]["height"]
    labels = [("off", "FSR 1 关（present-scale）", sf["offImage"]),
              ("on", "FSR 1 开（EASU + RCAS）", sf["onImage"])]
    lines = ["", f"## 桌面无头 Edge · FSR 1 空间超分对照（{out_w}×{out_h}）", "",
             f'{run["browser"]}，{run["adapter"]}，固定 {run["guestWorkers"]} 个游戏执行线程。'
             f'同一份日版 `PCSG00214` 第一场可控战斗出生点，将原生 {run["nativeStage"][0]}×{run["nativeStage"][1]} '
             f'输出放大至 {out_w}×{out_h}，先在单次 WebGPU 提交内采得同帧无损对比图，再经界面开关顺序静置采样各 600 秒。',
             "",
             "| FSR 1 状态 | 输出分辨率 | 核验 GPU 通道（600 秒内） | 实际画面 FPS | 中央区域 FPS | 重复画面占比 | 画面更新时间间隔 P95 | 同帧无损原图 |",
             "|---|---|---|---:|---:|---:|---:|---|"]
    for key, label, raw_img in labels:
        arm = arms[key]
        m = arm["measurement"]
        p = arm["passes"]
        enabled = key == "on"
        if (arm["sampleSha256"] != run["sampleSha256"]
                or arm["fsr1"] is not enabled
                or arm["controlVerified"] is not True or arm["sceneReviewed"] is not True
                or m["status"] != "complete" or m["seconds"] != 600 or len(m["minutes"]) != 10
                or m["submissions"] <= 0 or m["duplicates"] + m["changed"] != m["submissions"]
                or not 0 < m["centerChanged"] <= m["changed"] <= m["submissions"]
                or any(sum(b[k] for b in m["minutes"]) != m[k] for k in ("submissions", "changed", "centerChanged"))):
            raise ValueError("Incomplete or inconsistent FSR observation: " + key)
        if enabled:
            if not (p["fsr1-easu"] > 0 and p["fsr1-easu"] == p["fsr1-rcas"] and p["present-scale"] == 0):
                raise ValueError("FSR ON pass counts inconsistent")
            pass_desc = f'EASU {p["fsr1-easu"]} / RCAS {p["fsr1-rcas"]}（present-scale 0）'
        else:
            if not (p["present-scale"] > 0 and p["fsr1-easu"] == 0 and p["fsr1-rcas"] == 0):
                raise ValueError("FSR OFF pass counts inconsistent")
            pass_desc = f'present-scale {p["present-scale"]}（FSR 0）'
        if sha(results / arm["evidence"]) != arm["evidenceSha256"]:
            raise ValueError("Reviewed FSR battle montage changed: " + key)
        lines.append(
            f'| [{label}]({arm["evidence"]}) | {m["width"]}×{m["height"]} | {pass_desc} | '
            f'**{m["changed"]/600:.2f}** | {m["centerChanged"]/600:.2f} | '
            f'{100*m["duplicates"]/m["submissions"]:.1f}% | {m["p95ChangeGapMs"]:.1f} ms | '
            f'[1440×816 原图]({raw_img}) |'
        )
    lines.extend(["", run["assessment"], "",
                  f'[2× 同帧细节放大对比]({sf["zoomImage"]}) · [FSR 关原图]({sf["offImage"]}) · '
                  f'[FSR 开原图]({sf["onImage"]}) · [原始记录与逐分钟数据]({record})',
                  "", "| 每分钟实际画面 FPS（1440×816） | " + " | ".join(str(i) for i in range(1, 11)) + " |",
                  "|---|" + "---:|" * 10])
    for key, label, _ in labels:
        minutes = arms[key]["measurement"]["minutes"]
        lines.append("| " + label + " | " + " | ".join(f'{b["changed"]/60:.2f}' for b in minutes) + " |")
    return lines


def render():
    results = ROOT / "results"
    sample = json_file(ROOT / "bench/sample.lock.json")
    locks = json_file(ROOT / "bench/players.lock.json")
    cases = json_file(results / "cases.json")
    lines = ["# 《战斗的五芒星》首轮浏览器对测", "",
             f"日版 `{sample['titleId']}` v01.00。两个播放器收到相同的 {sample['PCSG00214.zip']['files']} 个游戏文件。"
             f"输入 ZIP 的 SHA-256 为 `{sample['PCSG00214.zip']['sha256']}`。", "",
             "| 设备与证据 | 核心 | 冷启动首个渲染提交 | 可辨识游戏画面 | 战斗场景持续 FPS（600 秒） | 游戏内存档 → 关闭页面 → 读回 | 实测观察 |",
             "|---|---|---|---|---|---|---|"]
    for case in cases:
        if "battleComparison" in case:
            block = battle_comparison(results, case["battleComparison"], sample, case.get("threadPolicy"))
            if case.get("fsrComparison"):
                block.extend(fsr_comparison(results, case["fsrComparison"], sample))
            block.extend(["", "## 其他场景与设备", ""])
            lines[4:4] = block
            continue
        kind = case["class"]
        for core, entry in case["cores"].items():
            name = {"vitaslop":"Vitaslop","vita3k":"Vita3K Web"}[core]
            first = picture = fps = save = "待实测"
            note = case.get("pending","")
            label = case["device"]
            if entry and "workbench" in entry:
                trial = entry["workbench"]
                evidence = trial["evidence"]
                if not (results / evidence).is_file():
                    raise ValueError("Missing workbench evidence: " + evidence)
                label = f"[{label}]({evidence})"
                name += " 工作台"
                first, picture, fps, save, note = (trial[k] for k in
                    ("first", "picture", "battle", "save", "observation"))
            elif entry is not None:
                file = "runs/" + entry["file"]
                r = json_file(results / file)
                revision = locks[core]["deploymentCommit"]
                if "patchSha256" in entry:
                    revision += "+" + entry["patchSha256"]
                if (r["sampleSha256"] != sample["PCSG00214.zip"]["sha256"] or r["deviceClass"] != kind
                    or r["engine"] != core or r["revision"] != revision):
                    raise ValueError("Input/core/device mismatch: " + file)
                p = (r.get("probe") or {}) if "phases" in r else r
                observed = p.get("firstFrameMs")
                first = f"{observed} ms（渲染提交）" if observed is not None else (
                    "未观察到" if p.get("started") is not None else "未启动")
                if r.get("coldBoot") is False:
                    first = "非冷启动"
                confirmed = p.get("pictureConfirmed")
                confirmed_ms = p.get("pictureConfirmedMs")
                picture = ("未确认" if observed is not None else "未观察到")
                if confirmed:
                    picture = f"{confirmed_ms} ms（人工确认）" if confirmed_ms is not None else "人工已确认"
                if entry.get("review"):
                    if observed is None:
                        raise ValueError("Reviewed picture without a render submission: " + file)
                    picture = reviewed_picture(results, r, entry["review"])
                    confirmed = True
                window = p.get("fpsWindow") or {}
                valid = (window.get("scene") == "PCSG00214-first-battle-idle-v1" and
                         window.get("status") == "complete" and window.get("seconds") == 600 and confirmed)
                fps = f"{window['fps']:.2f}" if valid else ("无有效采样" if confirmed else "未进入采样场景")
                save = "未验证"
                if entry.get("reloadFile"):
                    reload_run = json_file(results / "runs" / entry["reloadFile"])
                    if any(reload_run[k] != r[k] for k in ("engine","revision","sampleSha256","deviceClass")):
                        raise ValueError("Reload evidence mismatch: " + entry["reloadFile"])
                    wrote = p.get("save") or {}
                    loaded = reload_run.get("save") or {}
                    if (wrote.get("status") == "written-by-operator" and loaded.get("status") == "read-back-by-operator"
                        and loaded.get("written") == wrote and loaded.get("readDocumentId") != wrote["documentId"]):
                        save = "游戏内读回已确认"
                label = f"[{label}]({file})"
                note = entry["observation"]
            lines.append("| " + " | ".join(map(cell,[label,name,first,picture,fps,save,note])) + " |")
    lines += ["", "首帧计时从 Play 开始。“取样”表示该时刻采得的截图已经人工核对，画面可能更早出现。"
              "持续 FPS 仅使用已确认画面的有效 600 秒采样。存读档需同一试次的写档与重开读回两份证据。"
              "虚拟机结果仅代表所列客体、浏览器和图形配置。", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    (ROOT / "results/COMPARISON.md").write_text(render())
