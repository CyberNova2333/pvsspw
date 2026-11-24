"""Prepare the hash-locked players and identical local Battle Pentagram input."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache/pvsspw"
TITLE = "PCSG00214"
# JPN base game only. The shared archive also contains a desktop installation.
PREFIX = "TheBattlePentagram_JPN/Vita3K/"
GAME = PREFIX + "ux0/app/" + TITLE + "/"
ARCHIVE_HASH = "c4b90c0e2f4daec8c177bd637d920124075ac8bfa6becbe20719dcddd30bcf11"


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def players():
    manifest = json.loads((ROOT / "bench/players.lock.json").read_text())

    expected = {name + "/" + file: digest for name, engine in manifest.items()
                for file, digest in engine["files"].items()}
    seen = set()
    with tarfile.open(ROOT / "bench/runtime/players.tar.gz", "r|gz") as bundle:
        for member in bundle:
            if not member.isfile() or member.name in seen or member.name not in expected:
                raise ValueError(f"Unexpected runtime archive entry: {member.name}")
            seen.add(member.name)
            dest = CACHE / "players" / member.name
            digest = expected[member.name]
            if dest.is_file() and sha(dest) == digest:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False) as f:
                tmp = Path(f.name)
            try:
                with bundle.extractfile(member) as src, tmp.open("wb") as target:
                    shutil.copyfileobj(src, target, 1 << 20)
                if sha(tmp) != digest:
                    raise ValueError(f"Runtime fingerprint mismatch: {member.name}")
                tmp.replace(dest)
            finally:
                tmp.unlink(missing_ok=True)
    if seen != expected.keys():
        raise ValueError(f"Runtime archive incomplete: {sorted(expected.keys() - seen)}")
    print(f"Verified {len(seen)} runtime files.")


def inputs(archive):
    if sha(archive) != ARCHIVE_HASH:
        raise ValueError("Archive SHA-256 differs from the pinned JPN release.")
    dest = CACHE / "inputs"
    dest.mkdir(parents=True, exist_ok=True)
    result = {"titleId": TITLE, "archiveSha256": ARCHIVE_HASH}
    with zipfile.ZipFile(archive) as source, tempfile.TemporaryDirectory(dir=dest) as scratch:
        for filename, roots, base in [(TITLE + ".zip", [GAME], GAME),
                                      ("firmware.zip", [PREFIX + name + "/" for name in ("os0", "vs0", "sa0")], PREFIX)]:
            tmp = Path(scratch) / filename
            selected = sorted((i for i in source.infolist() if not i.is_dir()
                               and any(i.filename.startswith(root) for root in roots)), key=lambda i: i.filename)
            with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED) as target:
                for item in selected:
                    relative = item.filename[len(base):]
                    info = zipfile.ZipInfo(relative, (1980, 1, 1, 0, 0, 0))
                    info.create_system = 3
                    info.external_attr = 0o100644 << 16
                    info.file_size = item.file_size
                    with source.open(item) as src, target.open(info, "w") as dst:
                        shutil.copyfileobj(src, dst, 1 << 20)
            result[filename] = {"sha256": sha(tmp), "bytes": tmp.stat().st_size, "files": len(selected)}
        expected = ROOT / "bench/sample.lock.json"
        if expected.exists() and json.loads(expected.read_text()) != result:
            raise ValueError("Normalized files differ from the sample lock.")
        for path in Path(scratch).iterdir():
            path.replace(dest / path.name)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("step", choices=["players", "inputs"])
    parser.add_argument("--archive", type=Path, default=ROOT.parent.parent / "resources/TheBattlePentagram_JPN.zip")
    args = parser.parse_args()
    if args.step == "players":
        players()
    else:
        inputs(args.archive)
