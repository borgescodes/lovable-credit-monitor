import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import sync_demo_runtime


class DemoRuntimeSyncTests(unittest.TestCase):
    def test_copy_runtime_preserves_exact_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            mirror = root / "docs" / "demo" / "runtime"
            source.mkdir(parents=True)
            fixture = b"line-one\nline-two\r\n\x80\xff"
            for name in sync_demo_runtime.RUNTIME_FILES:
                (source / name).write_bytes(fixture + name.encode("ascii"))

            sync_demo_runtime.copy_runtime(source, mirror)

            for name in sync_demo_runtime.RUNTIME_FILES:
                self.assertEqual((mirror / name).read_bytes(), fixture + name.encode("ascii"))

    def test_verify_runtime_reports_changed_and_missing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            mirror = root / "runtime"
            source.mkdir()
            mirror.mkdir()
            for name in sync_demo_runtime.RUNTIME_FILES:
                payload = f"canonical:{name}".encode("ascii")
                (source / name).write_bytes(payload)
                (mirror / name).write_bytes(payload)
            (mirror / "content.js").write_bytes(b"drift")
            (mirror / "icons.js").unlink()

            self.assertEqual(
                sync_demo_runtime.verify_runtime(source, mirror),
                ["content.js: hash mismatch", "icons.js: missing mirror"],
            )

    def test_repository_runtime_check_passes_for_generated_mirror(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "sync_demo_runtime.py"), "--check"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
