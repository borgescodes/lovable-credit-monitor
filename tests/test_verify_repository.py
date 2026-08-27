import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'verify_repository.py'
spec = importlib.util.spec_from_file_location('verify_repository', SCRIPT)
verify_repository = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(verify_repository)


class DemoStaticVerificationTests(unittest.TestCase):
    def test_repository_verifier_runs_as_a_direct_script(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT)],
            cwd=SCRIPT.parents[1],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertIn("[FAIL] runtime source hash mismatch:", result.stderr)
        self.assertNotIn("ModuleNotFoundError", result.stderr)

    def test_privacy_copy_saying_no_analytics_is_allowed(self):
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


if __name__ == '__main__':
    unittest.main()
