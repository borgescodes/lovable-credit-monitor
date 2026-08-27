import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "docs" / "index.html"
CSS_PATH = ROOT / "docs" / "styles.css"
DEMO_HTML_PATH = ROOT / "docs" / "demo" / "index.html"
DEMO_CSS_PATH = ROOT / "docs" / "demo" / "demo-workspace.css"
DEMO_JS_PATH = ROOT / "docs" / "demo.js"


def css_property(css, selector, property_name):
    rule = re.search(rf"{re.escape(selector)}\s*\{{([^}}]+)\}}", css)
    if not rule:
        raise AssertionError(f"Missing CSS rule: {selector}")
    declaration = re.search(rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*([^;]+)", rule.group(1))
    if not declaration:
        raise AssertionError(f"Missing {property_name} in CSS rule: {selector}")
    return declaration.group(1).strip()


def resolve_css_hex(css, value):
    variable = re.fullmatch(r"var\((--[a-z0-9-]+)\)", value)
    if variable:
        value = css_property(css, ".demo-workspace", variable.group(1))
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise AssertionError(f"Expected an opaque six-digit CSS color, got: {value}")
    return value


def relative_luminance(hex_color):
    channels = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [
        channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(foreground, background):
    lighter, darker = sorted((relative_luminance(foreground), relative_luminance(background)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


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
        cls.demo_css = DEMO_CSS_PATH.read_text(encoding="utf-8")
        cls.demo_js = DEMO_JS_PATH.read_text(encoding="utf-8")
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

    def test_landing_has_presentation_only_hero_and_interactive_main_demo(self):
        hero = self.tags("iframe", **{"class": "hero-runtime-frame"})
        demo = self.tags("iframe", **{"class": "interactive-runtime-frame"})
        self.assertEqual(hero[0][1].get("tabindex"), "-1")
        self.assertEqual(hero[0][1].get("aria-hidden"), "true")
        self.assertEqual(hero[0][1].get("src"), "demo/index.html?surface=hero")
        self.assertNotIn("tabindex", demo[0][1])
        self.assertEqual(demo[0][1].get("title"), "Interactive Credit Monitor demo")

    def test_landing_does_not_own_product_controls_or_state(self):
        forbidden = (
            'class="credit-monitor"', "monitor-full", "monitor-compact",
            "monitor-minimal", "monitor-ring", "data-view=", "data-theme=",
            "limit: 100", "used: 64", "remaining: 36", "AVAILABLE",
        )
        for value in forbidden:
            self.assertNotIn(value, self.html)

    def test_supplied_brand_assets_are_used(self):
        self.assertIn('src="assets/lovable.svg"', self.html)
        self.assertIn('src="assets/github.svg"', self.html)
        github = (ROOT / "docs" / "assets" / "github.svg").read_text(encoding="utf-8")
        self.assertIn('fill="#FFFFFF"', github)
        self.assertNotIn('fill="#1b1f23"', github)

    def test_landing_script_does_not_own_runtime_controls_or_state(self):
        forbidden = (
            "#lcm-panel", ".credit-monitor", "[data-view]", "[data-theme]",
            "used", "limit", "remaining", "palette", "sync",
        )
        for value in forbidden:
            self.assertNotIn(value, self.demo_js)

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

    def test_demo_loads_workspace_styles_before_runtime_and_defers_every_script(self):
        stylesheets = [
            attrs.get("href")
            for tag, attrs in self.demo_parser.tags
            if tag == "link" and attrs.get("rel") == "stylesheet"
        ]
        self.assertEqual(stylesheets, ["demo-workspace.css", "runtime/panel.css"])
        scripts = [attrs for tag, attrs in self.demo_parser.tags if tag == "script"]
        self.assertTrue(scripts)
        self.assertTrue(all("defer" in attrs for attrs in scripts))

    def test_demo_workspace_css_never_targets_runtime_or_escapes_its_scope(self):
        self.assertNotIn("#lcm-panel", self.demo_css)
        self.assertNotIn(".lcm-", self.demo_css)
        rule_headers = re.findall(r"([^{}]+)\{", self.demo_css)
        selectors = [
            selector.strip()
            for header in rule_headers
            if not header.strip().startswith("@")
            for selector in header.split(",")
        ]
        self.assertTrue(selectors)
        self.assertTrue(all(selector.startswith(".demo-workspace") for selector in selectors), selectors)

    def test_demo_workspace_small_text_meets_wcag_aa_contrast(self):
        contrast_pairs = (
            (".demo-workspace .preview-metrics span", ".demo-workspace .preview-document"),
            (".demo-workspace .canvas-toolbar p", ".demo-workspace .canvas-toolbar"),
            (".demo-workspace .canvas-status", ".demo-workspace .canvas-status"),
        )
        for foreground_selector, background_selector in contrast_pairs:
            with self.subTest(foreground=foreground_selector, background=background_selector):
                foreground = resolve_css_hex(
                    self.demo_css,
                    css_property(self.demo_css, foreground_selector, "color"),
                )
                background = resolve_css_hex(
                    self.demo_css,
                    css_property(self.demo_css, background_selector, "background"),
                )
                self.assertGreaterEqual(contrast_ratio(foreground, background), 4.5)

    def test_demo_workspace_labels_truth_and_uses_lovable_brand(self):
        self.assertIn("Real interface · simulated usage data", self.demo_html)
        self.assertEqual(len(self.demo_tags("img", src="../assets/lovable.svg")), 1)

    def test_demo_document_never_reimplements_monitor_markup(self):
        classes = " ".join(attrs.get("class", "") for _, attrs in self.demo_parser.tags)
        self.assertNotIn("credit-monitor", classes)
        self.assertNotIn("monitor-full", classes)
        self.assertNotIn("lcm-view", classes)
        self.assertNotIn('id="lcm-panel"', self.demo_html)

    def test_demo_fictional_connection_indicator_is_decorative(self):
        self.assertEqual(
            len(self.demo_tags("span", **{"class": "conversation-status", "aria-hidden": "true"})),
            1,
        )
        self.assertEqual(len(self.demo_tags("span", **{"class": "conversation-status", "aria-label": "Connected"})), 0)

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
        self.assertEqual(len(self.tags("a", **{"class": "text-link nav-install", "href": "#install"})), 1)
        self.assertEqual(len(self.tags("a", **{"class": "button button-small button-ghost header-source"})), 1)
        self.assertIn(".nav-install", self.css)
        self.assertIn(".header-source { display: none; }", self.css)

if __name__ == "__main__":
    unittest.main()
