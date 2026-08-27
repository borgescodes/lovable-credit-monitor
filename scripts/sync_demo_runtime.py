#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "src"
DESTINATION_ROOT = ROOT / "docs" / "demo" / "runtime"
RUNTIME_FILES = (
    "panel.css",
    "state.js",
    "collector.js",
    "brand.js",
    "icons.js",
    "sync.js",
    "content.js",
)


def digest_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def copy_runtime(source_root: Path, destination_root: Path) -> None:
    destination_root.mkdir(parents=True, exist_ok=True)
    for name in RUNTIME_FILES:
        (destination_root / name).write_bytes((source_root / name).read_bytes())


def verify_runtime(source_root: Path, destination_root: Path) -> list[str]:
    failures: list[str] = []
    for name in RUNTIME_FILES:
        source_path = source_root / name
        mirror_path = destination_root / name
        if not source_path.exists():
            failures.append(f"{name}: missing source")
        elif not mirror_path.exists():
            failures.append(f"{name}: missing mirror")
        elif digest_bytes(source_path.read_bytes()) != digest_bytes(mirror_path.read_bytes()):
            failures.append(f"{name}: hash mismatch")
    extras = sorted(
        path.name
        for path in destination_root.iterdir()
        if path.is_file() and path.name not in RUNTIME_FILES
    ) if destination_root.exists() else []
    failures.extend(f"{name}: unexpected mirror" for name in extras)
    return sorted(failures)


def main() -> int:
    parser = argparse.ArgumentParser(description="Mirror canonical runtime files into the demo.")
    parser.add_argument("--check", action="store_true", help="verify the mirror without writing files")
    args = parser.parse_args()

    if not args.check:
        copy_runtime(SOURCE_ROOT, DESTINATION_ROOT)

    failures = verify_runtime(SOURCE_ROOT, DESTINATION_ROOT)
    if failures:
        print("\n".join(failures))
        return 1
    print(f"Demo runtime matches canonical sources: {len(RUNTIME_FILES)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
