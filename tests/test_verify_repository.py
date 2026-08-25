import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'verify_repository.py'
spec = importlib.util.spec_from_file_location('verify_repository', SCRIPT)
verify_repository = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(verify_repository)


class DemoStaticVerificationTests(unittest.TestCase):
    def test_privacy_copy_saying_no_analytics_is_allowed(self):
        verify_repository.verify_demo_is_static()


if __name__ == '__main__':
    unittest.main()
