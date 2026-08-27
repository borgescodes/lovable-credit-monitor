import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "docs" / "index.html"
CSS_PATH = ROOT / "docs" / "styles.css"
DEMO_HTML_PATH = ROOT / "docs" / "demo" / "index.html"


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
        cls.demo_html = DEMO_HTML_PATH.read_text(encoding="utf-8")
        cls.demo_parser = LandingParser()
        cls.demo_parser.feed(cls.demo_html)

    def tags(self, tag, **attrs):
        return [
            found
            for found in self.parser.tags
            if found[0] == tag and all(key in found[1] and found[1][key] == value for key, value in attrs.items())
        ]

    def demo_tags(self, tag, **attrs):
        return [
            found
            for found in self.demo_parser.tags
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
        self.assertEqual(len(self.tags("div", id="installation-help")), 1)
        self.assertGreaterEqual(len(self.tags("a", href="#installation-help")), 2)

    def test_demo_loads_real_runtime_after_adapter(self):
        sources = [attrs.get("src") for tag, attrs in self.demo_parser.tags if tag == "script"]
        self.assertEqual(sources, [
            "runtime/state.js",
            "runtime/collector.js",
            "runtime/brand.js",
            "runtime/icons.js",
            "runtime/sync.js",
            "demo-adapter.js",
            "runtime/content.js",
        ])

    def test_demo_workspace_labels_truth_and_uses_lovable_brand(self):
        self.assertIn("Real interface · simulated usage data", self.demo_html)
        self.assertEqual(len(self.demo_tags("img", src="../assets/lovable.svg")), 1)

    def test_demo_document_never_reimplements_monitor_markup(self):
        classes = " ".join(attrs.get("class", "") for _, attrs in self.demo_parser.tags)
        self.assertNotIn("credit-monitor", classes)
        self.assertNotIn("monitor-full", classes)
        self.assertNotIn("lcm-view", classes)
        self.assertNotIn('id="lcm-panel"', self.demo_html)

    def test_static_site_does_not_gain_remote_dependencies(self):
        for tag, attrs in self.parser.tags:
            if tag == "script":
                self.assertFalse((attrs.get("src") or "").startswith(("http://", "https://")))
            if tag == "link":
                self.assertFalse((attrs.get("href") or "").startswith(("http://", "https://")))
        self.assertNotRegex(self.css, re.compile(r"@import\s+url\(\s*['\"]?https?://", re.IGNORECASE))

    def test_polish_removes_nonsemantic_decoration_and_scopes_reduced_motion(self):
        self.assertEqual(len(self.tags("span", **{"class": "eyebrow"})), 1)
        evidence_icons = self.tags("svg", **{"class": "evidence-icon", "aria-hidden": "true"})
        self.assertEqual(len(evidence_icons), 3)
        self.assertEqual(len(self.tags("article", **{"class": "evidence-group"})), 3)
        self.assertNotIn("feature-index", self.html)
        self.assertNotIn("feature-card", self.html)
        for glyph in ("↻", "◫", "⚙", "◷", "◇", "→", "↓", "↑", "✓"):
            self.assertNotIn(glyph, self.html)
        self.assertNotIn(".install-illustration::before", self.css)
        reduced_motion = self.css.split("@media (prefers-reduced-motion: reduce)", 1)[1]
        self.assertNotIn("*, *::before, *::after", reduced_motion)
        self.assertIn(".ring-progress", reduced_motion)

    def test_finish_review_hierarchy_and_mobile_navigation(self):
        self.assertEqual(len(self.tags("ul", **{"class": "hero-trust-rail"})), 1)
        self.assertEqual(len(self.tags("li", **{"class": "trust-fact"})), 4)
        self.assertEqual(len(self.tags("button", **{"data-view": "full", "data-recommended": "true"})), 1)
        self.assertEqual(len(self.tags("a", **{"class": "text-link nav-install", "href": "#install"})), 1)
        self.assertEqual(len(self.tags("a", **{"class": "button button-small button-ghost header-source"})), 1)
        self.assertIn(".nav-install", self.css)
        self.assertIn(".header-source { display: none; }", self.css)


if __name__ == "__main__":
    unittest.main()
