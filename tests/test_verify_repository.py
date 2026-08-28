import importlib.util
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "verify_repository.py"
spec = importlib.util.spec_from_file_location("verify_repository", SCRIPT)
verify_repository = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(verify_repository)

DOWNLOAD_NAME = "lovable-credit-monitor-v0.7.2.zip"
APPROVED_LOVABLE_GEOMETRY_PAINT_SHA256 = "8a4741badb4ebbb904e2aaf34cdd092901f879d3f673c51a00337e2d745cea4a"
APPROVED_GITHUB_GEOMETRY_PAINT_SHA256 = "2b46384dd564b62292bf84afc7f6b684cff3dc55ab61d1ff5d3f9e9ebcdbc912"
REQUIRED_ZIP_FILES = (
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
)


class DemoStaticVerificationTests(unittest.TestCase):
    def make_docs(self, root: Path) -> Path:
        docs = root / "docs"
        (docs / "demo" / "runtime").mkdir(parents=True)
        (docs / "downloads").mkdir()
        (docs / "assets").mkdir()
        (docs / "index.html").write_text(
            f'<iframe src="demo/index.html"></iframe><a href="downloads/{DOWNLOAD_NAME}">Download</a>',
            encoding="utf-8",
        )
        (docs / "demo" / "index.html").write_text(
            '<script src="demo-adapter.js"></script>', encoding="utf-8"
        )
        (docs / "demo" / "demo-adapter.js").write_text("", encoding="utf-8")
        (docs / "demo.js").write_text("", encoding="utf-8")
        (docs / "downloads" / DOWNLOAD_NAME).write_bytes(b"fixture")
        return docs

    def write_zip(self, path: Path, names=REQUIRED_ZIP_FILES) -> None:
        with zipfile.ZipFile(path, "w") as archive:
            for name in names:
                archive.writestr(name, f"fixture:{name}")

    def test_repository_verifier_runs_as_a_direct_script(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT)],
            cwd=SCRIPT.parents[1],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Repository verification passed:", result.stdout)
        self.assertNotIn("ModuleNotFoundError", result.stderr)

    def test_source_hash_verifier_accepts_committed_runtime(self):
        verify_repository.verify_source_hashes()

    def test_iframe_reference_cannot_escape_docs(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "index.html").write_text(
                f'<iframe src="../outside.html"></iframe><a href="downloads/{DOWNLOAD_NAME}">Download</a>',
                encoding="utf-8",
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "reference escapes docs/"):
                    verify_repository.verify_demo_references()

    def test_unquoted_iframe_reference_cannot_escape_docs(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "index.html").write_text(
                f'<iframe src=../outside.html></iframe><a href="downloads/{DOWNLOAD_NAME}">Download</a>',
                encoding="utf-8",
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "reference escapes docs/"):
                    verify_repository.verify_demo_references()

    def test_nested_demo_reference_must_exist_relative_to_demo_document(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "demo" / "index.html").write_text(
                '<script src="runtime/missing.js"></script>', encoding="utf-8"
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "demo/index.html.*runtime/missing.js"):
                    verify_repository.verify_demo_references()

    def test_unquoted_nested_demo_reference_must_exist(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "demo" / "index.html").write_text(
                "<script src=runtime/missing.js></script>", encoding="utf-8"
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "demo/index.html.*runtime/missing.js"):
                    verify_repository.verify_demo_references()

    def test_privacy_copy_saying_no_analytics_is_allowed(self):
        verify_repository.verify_demo_is_static()

    def test_demo_adapter_cannot_gain_network_escape(self):
        mutations = {
            "fetch": "fetch('/usage')",
            "XMLHttpRequest": "new XMLHttpRequest()",
            "WebSocket": "new WebSocket('ws://localhost')",
            "sendBeacon": "navigator.sendBeacon('/usage')",
            "remote URL": "const endpoint = 'https://example.com/usage'",
        }
        for label, source in mutations.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                docs = self.make_docs(Path(directory))
                (docs / "demo" / "demo-adapter.js").write_text(source, encoding="utf-8")
                with patch.object(verify_repository, "DOCS", docs):
                    with self.assertRaisesRegex(AssertionError, label):
                        verify_repository.verify_demo_is_static()

    def test_demo_adapter_cannot_gain_protocol_relative_url(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "demo" / "demo-adapter.js").write_text(
                "const endpoint = '//example.com/usage'", encoding="utf-8"
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "remote URL"):
                    verify_repository.verify_demo_is_static()

    def test_iframe_html_cannot_gain_remote_runtime_dependency(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "demo" / "index.html").write_text(
                '<script src="https://example.com/runtime.js"></script>', encoding="utf-8"
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "remote runtime script"):
                    verify_repository.verify_demo_is_static()

    def test_iframe_html_cannot_gain_unquoted_remote_runtime_dependency(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "demo" / "index.html").write_text(
                "<script src=https://example.com/runtime.js></script>", encoding="utf-8"
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "remote runtime script"):
                    verify_repository.verify_demo_is_static()

    def test_iframe_html_cannot_gain_inline_network_call(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "demo" / "index.html").write_text(
                "<script>fetch('/usage')</script>", encoding="utf-8"
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "demo/index.html.*fetch"):
                    verify_repository.verify_demo_is_static()

    def test_demo_runtime_verifier_accepts_generated_mirror(self):
        verify_repository.verify_demo_runtime()

    def test_demo_runtime_verifier_names_drifted_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            mirror = root / "runtime"
            source.mkdir()
            mirror.mkdir()
            for name in verify_repository.RUNTIME_FILES:
                payload = f"canonical:{name}".encode("ascii")
                (source / name).write_bytes(payload)
                (mirror / name).write_bytes(payload)
            (mirror / "content.js").write_bytes(b"drift")

            with patch.object(verify_repository, "SOURCE_ROOT", source), patch.object(
                verify_repository, "DESTINATION_ROOT", mirror
            ):
                with self.assertRaisesRegex(AssertionError, "content\\.js: hash mismatch"):
                    verify_repository.verify_demo_runtime()

    def test_lovable_asset_geometry_and_paint_are_approved(self):
        self.assertTrue(
            hasattr(verify_repository, "verify_brand_assets"),
            "verify_brand_assets must enforce supplied logo geometry and paint",
        )
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            lovable = (SCRIPT.parents[1] / "docs" / "assets" / "lovable.svg").read_text(encoding="utf-8")
            lovable = lovable.replace('fill="#4B73FF"', 'fill="#000000"', 1)
            (docs / "assets" / "lovable.svg").write_text(lovable, encoding="utf-8")
            (docs / "assets" / "github.svg").write_text(
                (SCRIPT.parents[1] / "docs" / "assets" / "github.svg").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "Lovable.*geometry/paint"):
                    verify_repository.verify_brand_assets()

    def test_supplied_lovable_asset_matches_approved_fixture_digest(self):
        lovable = SCRIPT.parents[1] / "docs" / "assets" / "lovable.svg"
        self.assertEqual(
            verify_repository._svg_geometry_paint_digest(lovable),
            APPROVED_LOVABLE_GEOMETRY_PAINT_SHA256,
        )
        self.assertEqual(
            verify_repository.APPROVED_LOVABLE_GEOMETRY_PAINT_SHA256,
            APPROVED_LOVABLE_GEOMETRY_PAINT_SHA256,
        )

    def test_github_visible_path_must_be_pure_white(self):
        self.assertTrue(
            hasattr(verify_repository, "verify_brand_assets"),
            "verify_brand_assets must enforce supplied logo geometry and paint",
        )
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            for name in ("lovable.svg", "github.svg"):
                source = (SCRIPT.parents[1] / "docs" / "assets" / name).read_text(encoding="utf-8")
                if name == "github.svg":
                    source = source.replace('fill="#FFFFFF"', 'fill="#FEFEFE"', 1)
                (docs / "assets" / name).write_text(source, encoding="utf-8")
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "GitHub.*#FFFFFF"):
                    verify_repository.verify_brand_assets()

    def test_github_geometry_paint_rejects_hidden_or_extra_drawables(self):
        mutations = {
            "hidden path": ('<path fill="#FFFFFF"', '<path transform="scale(0)" fill="#FFFFFF"'),
            "extra drawable": ("</svg>", '<circle cx="512" cy="512" r="10" fill="#FFFFFF"></circle></svg>'),
        }
        for label, (old, new) in mutations.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                docs = self.make_docs(Path(directory))
                for name in ("lovable.svg", "github.svg"):
                    source = (SCRIPT.parents[1] / "docs" / "assets" / name).read_text(encoding="utf-8")
                    if name == "github.svg":
                        source = source.replace(old, new, 1)
                    (docs / "assets" / name).write_text(source, encoding="utf-8")
                with patch.object(verify_repository, "DOCS", docs):
                    with self.assertRaisesRegex(AssertionError, "GitHub.*geometry/paint"):
                        verify_repository.verify_brand_assets()

    def test_supplied_github_asset_matches_complete_fixture_digest(self):
        github = SCRIPT.parents[1] / "docs" / "assets" / "github.svg"
        self.assertEqual(
            verify_repository._svg_geometry_paint_digest(github),
            APPROVED_GITHUB_GEOMETRY_PAINT_SHA256,
        )
        self.assertEqual(
            getattr(verify_repository, "APPROVED_GITHUB_GEOMETRY_PAINT_SHA256", None),
            APPROVED_GITHUB_GEOMETRY_PAINT_SHA256,
        )

    def test_download_zip_keeps_exact_public_name(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            (docs / "downloads" / DOWNLOAD_NAME).unlink()
            self.write_zip(docs / "downloads" / "credit-monitor.zip")
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, DOWNLOAD_NAME):
                    verify_repository.verify_download_zip()

    def test_download_zip_keeps_every_required_runtime_file(self):
        with tempfile.TemporaryDirectory() as directory:
            docs = self.make_docs(Path(directory))
            self.write_zip(
                docs / "downloads" / DOWNLOAD_NAME,
                [name for name in REQUIRED_ZIP_FILES if name != "src/content.js"],
            )
            with patch.object(verify_repository, "DOCS", docs):
                with self.assertRaisesRegex(AssertionError, "src/content.js"):
                    verify_repository.verify_download_zip()


if __name__ == "__main__":
    unittest.main()
