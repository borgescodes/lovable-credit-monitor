#!/usr/bin/env python3
"""Publication-readiness checks for the Credit Monitor repository."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.sync_demo_runtime import DESTINATION_ROOT, RUNTIME_FILES, SOURCE_ROOT, verify_runtime

DOCS = ROOT / "docs"
DOWNLOAD_NAME = "lovable-credit-monitor-v0.7.2.zip"
DOWNLOAD = DOCS / "downloads" / DOWNLOAD_NAME
EXPECTED_VERSION = "0.7.2"
RUNTIME_ROOTS = (ROOT / "manifest.json", ROOT / "src", ROOT / "assets")


def ok(message: str) -> None:
    print(f"[OK] {message}")


def fail(message: str) -> None:
    raise AssertionError(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_manifest() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("manifest_version") != 3:
        fail("manifest_version must be 3")
    if manifest.get("version") != EXPECTED_VERSION:
        fail(f"manifest version must be {EXPECTED_VERSION}")
    if manifest.get("permissions") != ["storage", "alarms"]:
        fail("extension permissions changed from the approved v0.7.2 baseline")
    expected_hosts = ["https://lovable.dev/*", "https://*.lovable.dev/*"]
    if manifest.get("host_permissions") != expected_hosts:
        fail("host_permissions changed from the approved v0.7.2 baseline")
    ok("Manifest V3 metadata and permissions")


def verify_source_hashes() -> None:
    hash_file = ROOT / ".source-hashes.sha256"
    if not hash_file.exists():
        fail(".source-hashes.sha256 is missing")

    recorded: dict[str, str] = {}
    for line in hash_file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        digest, rel = line.split(maxsplit=1)
        recorded[rel.strip()] = digest

    current_files: list[Path] = [ROOT / "manifest.json"]
    current_files += sorted(path for path in (ROOT / "src").rglob("*") if path.is_file())
    current_files += sorted(path for path in (ROOT / "assets").rglob("*") if path.is_file())
    current_rel = {path.relative_to(ROOT).as_posix() for path in current_files}

    if current_rel != set(recorded):
        missing = sorted(set(recorded) - current_rel)
        added = sorted(current_rel - set(recorded))
        fail(f"runtime file set changed; missing={missing}, added={added}")

    mismatches = []
    for rel, expected in recorded.items():
        actual = sha256(ROOT / rel)
        if actual != expected:
            mismatches.append(rel)
    if mismatches:
        fail(f"runtime source hash mismatch: {', '.join(mismatches)}")
    ok("Original v0.7.2 runtime files remain byte-for-byte unchanged")


def verify_download_zip() -> None:
    if not DOWNLOAD.exists():
        fail(f"download package missing: docs/downloads/{DOWNLOAD_NAME}")

    with zipfile.ZipFile(DOWNLOAD) as archive:
        names = [name for name in archive.namelist() if not name.endswith("/")]
        if not names:
            fail("download package is empty")
        if "manifest.json" not in names:
            fail("download package does not contain manifest.json at root")
        for name in names:
            allowed = (
                name == "manifest.json"
                or name == "EXTENSION_README.md"
                or name.startswith("src/")
                or name.startswith("assets/")
            )
            if not allowed:
                fail(f"unexpected file in extension ZIP: {name}")
            if name.lower().endswith(".zip"):
                fail(f"nested ZIP in extension package: {name}")
            if name.startswith(("docs/", ".git/", "_inspect/")):
                fail(f"repository-only content leaked into extension ZIP: {name}")
    ok("Installable ZIP contains extension files only")


def verify_demo_references() -> None:
    html_path = DOCS / "index.html"
    html = html_path.read_text(encoding="utf-8")
    if DOWNLOAD_NAME not in html:
        fail("demo does not reference the exact distribution filename")

    attr_pattern = re.compile(r'''(?:src|href)=["']([^"']+)["']''', re.IGNORECASE)
    missing = []
    for raw in attr_pattern.findall(html):
        parsed = urlparse(raw)
        if parsed.scheme or raw.startswith(("#", "mailto:", "tel:")):
            continue
        rel = parsed.path
        if not rel:
            continue
        target = (DOCS / rel).resolve()
        try:
            target.relative_to(DOCS.resolve())
        except ValueError:
            fail(f"demo reference escapes docs/: {raw}")
        if not target.exists():
            missing.append(raw)
    if missing:
        fail(f"missing local demo references: {', '.join(sorted(set(missing)))}")
    ok("GitHub Pages local asset and download references")


def verify_demo_is_static() -> None:
    js = (DOCS / "demo.js").read_text(encoding="utf-8")
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    forbidden_js = {
        "fetch(": "network fetch",
        "XMLHttpRequest": "XHR",
        "chrome.": "Chrome extension API",
        "navigator.sendBeacon": "beacon telemetry",
    }
    for token, label in forbidden_js.items():
        if token in js:
            fail(f"demo.js contains forbidden {label}: {token}")
    if re.search(r"<script[^>]+src=[\"']https?://", html, re.IGNORECASE):
        fail("demo contains a remote runtime script")
    if re.search(r"<(?:link|img)[^>]+(?:href|src)=[\"']https?://", html, re.IGNORECASE):
        fail("demo contains a remote runtime asset")
    tracking_markers = re.compile(
        r"gtag\(|googletagmanager|segment\.com|mixpanel|plausible\.io|analytics\.js",
        re.IGNORECASE,
    )
    if tracking_markers.search(html + "\n" + js):
        fail("demo contains an analytics or tracking integration")
    ok("Demo is dependency-free and has no network or extension API calls")


def verify_demo_runtime() -> None:
    failures = verify_runtime(SOURCE_ROOT, DESTINATION_ROOT)
    if failures:
        fail("demo runtime drift: " + "; ".join(failures))
    ok(f"Demo runtime mirrors {len(RUNTIME_FILES)} canonical files byte-for-byte")


def verify_no_obvious_secrets() -> None:
    env_files = [path for path in ROOT.rglob("*") if path.is_file() and path.name.startswith(".env")]
    if env_files:
        fail(".env file present: " + ", ".join(str(p.relative_to(ROOT)) for p in env_files))

    ignored_dirs = {".git", "_inspect", "__pycache__"}
    ignored_files = {
        "verify_repository.py",
        "2026-08-25-lovable-credit-monitor-design.md",
        "2026-08-25-lovable-credit-monitor-repository.md",
    }
    patterns = {
        "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b"),
        "OpenAI key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
        "Supabase secret": re.compile(r"\bsb_secret_[A-Za-z0-9_-]{16,}\b"),
        "bearer token": re.compile(r"\bBearer\s+[A-Za-z0-9._~+/-]{24,}=*\b", re.IGNORECASE),
    }

    findings = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in ignored_dirs for part in path.parts):
            continue
        if path.name in ignored_files or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".zip"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in patterns.items():
            if pattern.search(text):
                findings.append(f"{label}: {path.relative_to(ROOT)}")
    if findings:
        fail("possible secret material found: " + "; ".join(findings))
    ok("No .env files or obvious credential patterns detected")


def verify_readme_contract() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    required = [
        "https://borgescodes.github.io/lovable-credit-monitor/",
        DOWNLOAD_NAME,
        "not affiliated with or endorsed by Lovable",
        "chrome://extensions",
        "edge://extensions",
    ]
    missing = [value for value in required if value.lower() not in readme.lower()]
    if missing:
        fail("README is missing required public-facing content: " + ", ".join(missing))
    ok("README demo, download, install and disclaimer contract")


def main() -> int:
    checks = [
        verify_manifest,
        verify_source_hashes,
        verify_download_zip,
        verify_demo_references,
        verify_demo_is_static,
        verify_demo_runtime,
        verify_no_obvious_secrets,
        verify_readme_contract,
    ]
    try:
        for check in checks:
            check()
    except (AssertionError, OSError, ValueError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1
    print(f"\nRepository verification passed: {len(checks)}/{len(checks)} checks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
