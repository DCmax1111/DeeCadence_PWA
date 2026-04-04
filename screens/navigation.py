from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.card import MDCard
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from shared.theme import (
    ORANGE, GREEN, GOLD, ACCENT,
    PANEL, TEXT, TEXT_DIM, hex_color
)

PURPLE = "#8b5cf6"
KNOWLEDGE_GREEN = "#00ff88"


def _c(h): return hex_color(h)


class HoverCard(MDCard):
    def __init__(self, normal_color, hover_color, **kwargs):
        super().__init__(**kwargs)
        self.normal_color = normal_color
        self.hover_color = hover_color
        self.md_bg_color = _c(normal_color)
        self.bind(
            on_press=self._on_press,
            on_release=self._on_release
        )

    def _on_press(self, *args):
        self.md_bg_color = _c(self.hover_color)

    def _on_release(self, *args):
        self.md_bg_color = _c(self.normal_color)


class NavigationScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self._built = False
        self._stat_labels = {}  # name -> MDLabel for live value

    def on_enter(self):
        if not self._built:
            self._build()
            self._built = True
        else:
            self._update_stats()

    def _update_stats(self):
        """Refresh stat values on home cards without rebuilding."""
        app = App.get_running_app()
        stats = app.db.fetchall("SELECT * FROM stats")
        for s in stats:
            if s["name"] in self._stat_labels:
                self._stat_labels[s["name"]].text = \
                    f"{int(s['value'])} · Rank {s['rank']}"

    def _build(self):
        app = App.get_running_app()
        stats = {s["name"]: dict(s)
                 for s in app.db.fetchall("SELECT * FROM stats")}

        root = MDBoxLayout(orientation="vertical")

        # ── Header ────────────────────────────────────────────────
        header = MDBoxLayout(
            orientation="vertical",
            size_hint_y=None, height=dp(88),
            padding=[dp(20), dp(14)],
            md_bg_color=_c("#080d1a")
        )
        header.add_widget(MDLabel(
            text="THE SYSTEM",
            font_style="H4",
            theme_text_color="Custom",
            text_color=_c(ACCENT),
            bold=True
        ))
        header.add_widget(MDLabel(
            text="What are you logging today?",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM)
        ))
        root.add_widget(header)

        # ── Scrollable body ───────────────────────────────────────
        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Module definitions ────────────────────────────────────
        modules = [
            {
                "label":   "◈  FINANCIAL",
                "screen":  "financial",
                "color":   ORANGE,
                "hover":   "#2a1500",
                "stat":    "Financial",
                "desc":    "Income · Expenses · Cashflow",
                "icon_bg": "#1a0e00",
            },
            {
                "label":   "⚡  ENERGY",
                "screen":  "energy",
                "color":   GREEN,
                "hover":   "#001a0d",
                "stat":    "Body",
                "desc":    "Sleep · Hydration · Exercise",
                "icon_bg": "#00120a",
            },
            {
                "label":   "✦  SPIRIT",
                "screen":  "spirit",
                "color":   GOLD,
                "hover":   "#1a1500",
                "stat":    "Spirit",
                "desc":    "Prayer · Bible · Leadership",
                "icon_bg": "#12100a",
            },
            {
                "label":   "🧠  MIND",
                "screen":  "mind",
                "color":   ACCENT,
                "hover":   "#001020",
                "stat":    "Mind",
                "desc":    "Focus · Clarity · Rest",
                "icon_bg": "#00091a",
            },
            {
                "label":   "📖  KNOWLEDGE",
                "screen":  "knowledge",
                "color":   KNOWLEDGE_GREEN,
                "hover":   "#001a0d",
                "stat":    "Knowledge",
                "desc":    "Study · Reading · Skills",
                "icon_bg": "#001208",
            },
            {
                "label":   "⚔  DEXTERITY",
                "screen":  "dexterity",
                "color":   PURPLE,
                "hover":   "#120a2a",
                "stat":    "Dexterity",
                "desc":    "Drawing · Design · Craft",
                "icon_bg": "#0d0618",
            },
        ]

        # ── 2-column grid, odd last card centered ─────────────────
        for i in range(0, len(modules), 2):
            pair = modules[i:i + 2]
            is_last_odd = len(pair) == 1

            row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(12),
                size_hint_y=None,
                height=dp(110)
            )

            if is_last_odd:
                # Left spacer
                row.add_widget(MDBoxLayout(size_hint_x=0.5))

            for m in pair:
                stat_data = stats.get(m["stat"], {})
                stat_val = int(stat_data.get("value", 1))
                stat_rank = stat_data.get("rank", "E")

                card = HoverCard(
                    normal_color=PANEL,
                    hover_color=m["hover"],
                    radius=[12],
                    elevation=0,
                    padding=[dp(14), dp(12)],
                    size_hint_x=0.5
                )

                content = MDBoxLayout(
                    orientation="vertical",
                    spacing=dp(4)
                )

                # Module name
                content.add_widget(MDLabel(
                    text=m["label"],
                    font_style="Button",
                    theme_text_color="Custom",
                    text_color=_c(m["color"]),
                    bold=True,
                    size_hint_y=None,
                    height=dp(24)
                ))

                # Description
                content.add_widget(MDLabel(
                    text=m["desc"],
                    font_style="Caption",
                    theme_text_color="Custom",
                    text_color=_c(TEXT_DIM),
                    size_hint_y=None,
                    height=dp(18)
                ))

                # Stat value + rank
                stat_label = MDLabel(
                    text=f"{stat_val} · Rank {stat_rank}",
                    font_style="Overline",
                    theme_text_color="Custom",
                    text_color=_c(m["color"]),
                    size_hint_y=None,
                    height=dp(18)
                )
                self._stat_labels[m["stat"]] = stat_label
                content.add_widget(stat_label)

                card.add_widget(content)

                sc = m["screen"]
                card.bind(on_release=lambda x, s=sc: setattr(
                    self.manager, "current", s))
                row.add_widget(card)

            if is_last_odd:
                # Right spacer
                row.add_widget(MDBoxLayout(size_hint_x=0.5))

            body.add_widget(row)

        # ── Stats dashboard button ─────────────────────────────────
        body.add_widget(MDBoxLayout(
            size_hint_y=None, height=dp(12)))

        dash_btn = MDRaisedButton(
            text="⌂  VIEW STAT DASHBOARD",
            md_bg_color=_c(PANEL),
            size_hint_y=None,
            height=dp(48),
            size_hint_x=1
        )
        dash_btn.bind(on_release=lambda x: setattr(
            self.manager, "current", "dashboard"))
        body.add_widget(dash_btn)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

