#!/usr/bin/env python3
"""Publication-readiness checks for the Credit Monitor repository."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.sync_demo_runtime import DESTINATION_ROOT, RUNTIME_FILES, SOURCE_ROOT, verify_runtime

DOCS = ROOT / "docs"
DOWNLOAD_NAME = "lovable-credit-monitor-v0.7.2.zip"
EXPECTED_VERSION = "0.7.2"
RUNTIME_ROOTS = (ROOT / "manifest.json", ROOT / "src", ROOT / "assets")
REQUIRED_DOWNLOAD_FILES = frozenset(
    {
        "manifest.json",
        "EXTENSION_README.md",
        "src/background.js",
        "src/brand.js",
        "src/collector.js",
        "src/content.js",
        "src/icons.js",
        "src/panel.css",
        "src/state.js",
        "src/sync.js",
        "assets/credit-monitor-default.svg",
        "assets/icon-16.png",
        "assets/icon-32.png",
        "assets/icon-48.png",
        "assets/icon-128.png",
    }
)
APPROVED_LOVABLE_GEOMETRY_PAINT_SHA256 = "8a4741badb4ebbb904e2aaf34cdd092901f879d3f673c51a00337e2d745cea4a"
APPROVED_GITHUB_GEOMETRY_PAINT_SHA256 = "2b46384dd564b62292bf84afc7f6b684cff3dc55ab61d1ff5d3f9e9ebcdbc912"
APPROVED_GITHUB_VIEWBOX = "0 0 1024 1024"
APPROVED_GITHUB_PATH_SHA256 = "11480cefca27efc0ef8dbe70b0e7e6ab2c91ccd67dc2a04af4a0e2ea5c1ea11e"
REMOTE_DEPENDENCY_ATTRIBUTES = {
    "audio": "src",
    "iframe": "src",
    "img": "src",
    "link": "href",
    "script": "src",
    "source": "src",
    "video": "src",
}


class DocumentAttributeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[str] = []
        self.dependencies: list[tuple[str, str]] = []
        self.duplicate_reference_attributes: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized: dict[str, str] = {}
        seen_reference_attributes: set[str] = set()
        for raw_name, value in attrs:
            name = raw_name.lower()
            if name in {"src", "href"}:
                if name in seen_reference_attributes:
                    self.duplicate_reference_attributes.append(name)
                seen_reference_attributes.add(name)
            if value is not None and name not in normalized:
                normalized[name] = value
        for name in ("src", "href"):
            if name in normalized:
                self.references.append(normalized[name])
        dependency_attribute = REMOTE_DEPENDENCY_ATTRIBUTES.get(tag.lower())
        if dependency_attribute and dependency_attribute in normalized:
            self.dependencies.append((tag.lower(), normalized[dependency_attribute]))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)


def parse_document_attributes(html: str) -> DocumentAttributeParser:
    parser = DocumentAttributeParser()
    parser.feed(html)
    parser.close()
    if parser.duplicate_reference_attributes:
        duplicates = ", ".join(sorted(set(parser.duplicate_reference_attributes)))
        fail(f"HTML contains duplicate {duplicates} reference attributes")
    return parser


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
    download_dir = DOCS / "downloads"
    download = download_dir / DOWNLOAD_NAME
    if not download.exists():
        fail(f"download package missing: docs/downloads/{DOWNLOAD_NAME}")
    zip_names = sorted(path.name for path in download_dir.glob("*.zip"))
    if zip_names != [DOWNLOAD_NAME]:
        fail(f"distribution ZIP name changed; expected only {DOWNLOAD_NAME}, found {zip_names}")

    with zipfile.ZipFile(download) as archive:
        names = [name for name in archive.namelist() if not name.endswith("/")]
        if not names:
            fail("download package is empty")
        missing = sorted(REQUIRED_DOWNLOAD_FILES - set(names))
        if missing:
            fail("download package is missing required files: " + ", ".join(missing))
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
    landing_path = DOCS / "index.html"
    landing_html = landing_path.read_text(encoding="utf-8")
    if DOWNLOAD_NAME not in landing_html:
        fail("demo does not reference the exact distribution filename")

    missing = []
    pending = [landing_path, DOCS / "demo" / "index.html"]
    inspected: set[Path] = set()
    while pending:
        html_path = pending.pop(0).resolve()
        if html_path in inspected:
            continue
        inspected.add(html_path)
        owner = html_path.relative_to(DOCS.resolve()).as_posix()
        html = html_path.read_text(encoding="utf-8")
        for raw in parse_document_attributes(html).references:
            parsed = urlparse(raw)
            if parsed.scheme or parsed.netloc or raw.startswith(("#", "mailto:", "tel:")):
                continue
            rel = parsed.path
            if not rel:
                continue
            target = (html_path.parent / rel).resolve()
            try:
                target.relative_to(DOCS.resolve())
            except ValueError:
                fail(f"demo reference escapes docs/: {owner} -> {raw}")
            if not target.exists():
                missing.append(f"{owner} references {raw}")
            elif target.suffix.lower() in {".html", ".htm"}:
                pending.append(target)
    if missing:
        fail(f"missing local demo references: {', '.join(sorted(set(missing)))}")
    ok(f"GitHub Pages references resolve across {len(inspected)} HTML documents")


def verify_demo_is_static() -> None:
    javascript = {
        "demo.js": (DOCS / "demo.js").read_text(encoding="utf-8"),
        "demo/demo-adapter.js": (DOCS / "demo" / "demo-adapter.js").read_text(encoding="utf-8"),
    }
    html_documents = {
        "index.html": (DOCS / "index.html").read_text(encoding="utf-8"),
        "demo/index.html": (DOCS / "demo" / "index.html").read_text(encoding="utf-8"),
    }
    network_call_patterns = (
        (re.compile(r"\bfetch\s*\("), "fetch"),
        (re.compile(r"\bXMLHttpRequest\b"), "XMLHttpRequest"),
        (re.compile(r"\bWebSocket\b"), "WebSocket"),
        (re.compile(r"\bsendBeacon\b"), "sendBeacon"),
    )
    remote_url_pattern = re.compile(
        r'''(?:https?|wss?)://|["'`]//(?=[^/\s"'`?#])''',
        re.IGNORECASE,
    )
    for name, source in javascript.items():
        for pattern, label in network_call_patterns:
            if pattern.search(source):
                fail(f"{name} contains forbidden {label}")
        if remote_url_pattern.search(source):
            fail(f"{name} contains forbidden remote URL")
    if "chrome." in javascript["demo.js"]:
        fail("demo.js contains forbidden Chrome extension API: chrome.")
    for name, html in html_documents.items():
        for pattern, label in network_call_patterns:
            if pattern.search(html):
                fail(f"{name} contains forbidden {label}")
        for tag, raw in parse_document_attributes(html).dependencies:
            parsed = urlparse(raw)
            if parsed.scheme.lower() in {"http", "https"} or parsed.netloc:
                dependency_kind = "script" if tag == "script" else "asset"
                fail(f"{name} contains a remote runtime {dependency_kind}")
    tracking_markers = re.compile(
        r"gtag\(|googletagmanager|segment\.com|mixpanel|plausible\.io|analytics\.js",
        re.IGNORECASE,
    )
    all_static_source = "\n".join((*html_documents.values(), *javascript.values()))
    if tracking_markers.search(all_static_source):
        fail("demo contains an analytics or tracking integration")
    ok("Landing and iframe demo have no network, analytics, or extension-runtime escape")


def _local_name(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def _svg_geometry_paint_digest(path: Path) -> str:
    root = ElementTree.fromstring(path.read_text(encoding="utf-8"))
    semantic_nodes = []
    for element in root.iter():
        attributes = sorted((_local_name(name), value) for name, value in element.attrib.items())
        semantic_nodes.append((_local_name(element.tag), attributes))
    payload = json.dumps(semantic_nodes, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def verify_brand_assets() -> None:
    lovable = DOCS / "assets" / "lovable.svg"
    if _svg_geometry_paint_digest(lovable) != APPROVED_LOVABLE_GEOMETRY_PAINT_SHA256:
        fail("Lovable supplied SVG geometry/paint does not match the approved digest")

    github_path = DOCS / "assets" / "github.svg"
    github = ElementTree.fromstring(github_path.read_text(encoding="utf-8"))
    if github.get("viewBox") != APPROVED_GITHUB_VIEWBOX:
        fail("GitHub SVG viewBox geometry changed")
    paths = [element for element in github.iter() if _local_name(element.tag) == "path"]
    if len(paths) != 1:
        fail("GitHub SVG must contain exactly one visible path")
    visible_path = paths[0]
    path_digest = hashlib.sha256((visible_path.get("d") or "").encode("utf-8")).hexdigest()
    if path_digest != APPROVED_GITHUB_PATH_SHA256:
        fail("GitHub visible path geometry changed")
    if (visible_path.get("fill") or "").upper() != "#FFFFFF":
        fail("GitHub visible path fill must remain pure white (#FFFFFF)")
    if _svg_geometry_paint_digest(github_path) != APPROVED_GITHUB_GEOMETRY_PAINT_SHA256:
        fail("GitHub supplied SVG geometry/paint does not match the approved digest")
    ok("Supplied Lovable and white GitHub brand geometry/paint")


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
        verify_brand_assets,
        verify_demo_runtime,
        verify_no_obvious_secrets,
        verify_readme_contract,
    ]
    try:
        for check in checks:
            check()
    except (
        AssertionError,
        OSError,
        ValueError,
        json.JSONDecodeError,
        zipfile.BadZipFile,
        ElementTree.ParseError,
    ) as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1
    print(f"\nRepository verification passed: {len(checks)}/{len(checks)} checks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
