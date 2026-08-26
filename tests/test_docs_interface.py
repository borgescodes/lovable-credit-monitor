import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "docs" / "index.html"
CSS_PATH = ROOT / "docs" / "styles.css"


class LandingParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.comments = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def handle_comment(self, data):
        self.comments.append(data)


class LandingStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = HTML_PATH.read_text(encoding="utf-8")
        cls.css = CSS_PATH.read_text(encoding="utf-8")
        cls.parser = LandingParser()
        cls.parser.feed(cls.html)

    def tags(self, tag, **attrs):
        return [
            found
            for found in self.parser.tags
            if found[0] == tag and all(key in found[1] and found[1][key] == value for key, value in attrs.items())
        ]

    def test_direction_contract_survives_in_html(self):
        direction_comment = next(comment for comment in self.parser.comments if "THESIS:" in comment)
        for marker in ("THESIS:", "OWN-WORLD:", "STORY:", "FIRST VIEWPORT:", "FORM:", "FINISH:"):
            self.assertIn(marker, direction_comment)
        self.assertIn("690409fa", direction_comment)

    def test_confidence_journey_has_stable_sections(self):
        expected_ids = ("top", "mechanism", "demo", "features", "privacy", "install")
        self.assertEqual(
            [attrs.get("id") for tag, attrs in self.parser.tags if tag == "section" and attrs.get("id") in expected_ids],
            list(expected_ids),
        )
        header = self.tags("header", **{"class": "site-header"})
        main = self.tags("main", id="main")
        footer = self.tags("footer", **{"class": "site-footer"})
        self.assertEqual((len(header), len(main), len(footer)), (1, 1, 1))

    def test_navigation_and_download_preserve_public_routes(self):
        links = {attrs.get("href") for tag, attrs in self.parser.tags if tag == "a"}
        for route in ("#demo", "#privacy", "#install", "https://github.com/borgescodes/lovable-credit-monitor"):
            self.assertIn(route, links)
        self.assertTrue(
            any(
                attrs.get("href") == "downloads/lovable-credit-monitor-v0.7.2.zip" and "download" in attrs
                for tag, attrs in self.parser.tags
                if tag == "a"
            )
        )

    def test_installation_walkthrough_is_truthful_and_actionable(self):
        walkthrough = self.tags("div", **{"class": "install-walkthrough"})
        self.assertEqual(len(walkthrough), 1)
        self.assertEqual(walkthrough[0][1].get("aria-label"), "Illustrated manual installation guide")
        install_steps = [attrs for tag, attrs in self.parser.tags if tag == "article" and attrs.get("class") == "install-step"]
        self.assertEqual([step.get("data-step") for step in install_steps], ["01", "02", "03"])
        illustrations = {attrs.get("class") for tag, attrs in self.parser.tags if tag == "div" and attrs.get("aria-hidden") == "true"}
        self.assertTrue({"install-illustration download-illustration", "install-illustration browser-illustration", "install-illustration result-illustration"}.issubset(illustrations))

    def test_demo_preserves_all_existing_choices(self):
        views = {attrs.get("data-view") for tag, attrs in self.parser.tags if "data-view" in attrs}
        themes = {attrs.get("data-theme") for tag, attrs in self.parser.tags if "data-theme" in attrs}
        self.assertTrue({"full", "compact", "minimal", "ring"}.issubset(views))
        self.assertTrue({"original", "red", "juparana", "mono"}.issubset(themes))
        self.assertGreaterEqual(len(self.tags("span", **{"data-progress": None})), 1)
        self.assertGreaterEqual(len(self.tags("circle", **{"data-ring": None})), 1)

    def test_static_site_does_not_gain_remote_dependencies(self):
        for tag, attrs in self.parser.tags:
            if tag == "script":
                self.assertFalse((attrs.get("src") or "").startswith(("http://", "https://")))
            if tag == "link":
                self.assertFalse((attrs.get("href") or "").startswith(("http://", "https://")))
        self.assertNotRegex(self.css, re.compile(r"@import\s+url\(\s*['\"]?https?://", re.IGNORECASE))

    def test_polish_removes_nonsemantic_decoration_and_scopes_reduced_motion(self):
        self.assertEqual(len(self.tags("span", **{"class": "eyebrow"})), 1)
        feature_markers = self.tags("div", **{"class": "feature-icon", "aria-hidden": "true"})
        self.assertEqual(len(feature_markers), 6)
        self.assertNotIn("feature-index", self.html)
        self.assertNotIn(".install-illustration::before", self.css)
        reduced_motion = self.css.split("@media (prefers-reduced-motion: reduce)", 1)[1]
        self.assertNotIn("*, *::before, *::after", reduced_motion)
        self.assertIn(".ring-progress", reduced_motion)


if __name__ == "__main__":
    unittest.main()
