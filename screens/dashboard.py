from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivy.uix.progressbar import ProgressBar
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from shared.theme import (
    STAT_COLORS, ORANGE, GREEN,
    PANEL, TEXT, TEXT_DIM, ACCENT,
    GOLD, get_rank, hex_color
)


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


class DashboardScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self._refresh_event = None
        # References to dynamic widgets
        self._stat_bars = {}   # name -> ProgressBar
        self._stat_vals = {}   # name -> MDLabel
        self._stat_ranks = {}  # name -> MDLabel
        self._built = False

    def on_enter(self):
        if not self._built:
            self._build()
            self._built = True
        else:
            self._update_stats()
        # Refresh only data every 5s — no rebuild
        self._refresh_event = Clock.schedule_interval(
            lambda dt: self._update_stats(), 5
        )

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def _update_stats(self):
        """Update only stat values — no widget rebuild."""
        app = App.get_running_app()
        stats = app.db.fetchall("SELECT * FROM stats ORDER BY name")
        for s in stats:
            name = s["name"]
            val = s["value"]
            rank = get_rank(val)
            color = STAT_COLORS.get(name, ACCENT)
            if name in self._stat_bars:
                self._stat_bars[name].value = val
            if name in self._stat_vals:
                self._stat_vals[name].text = str(int(val))
                self._stat_vals[name].color = _c(color)
            if name in self._stat_ranks:
                self._stat_ranks[name].text = f"Rank {rank}"
                self._stat_ranks[name].color = _c(color)

    def _build(self):
        app = App.get_running_app()
        root = MDBoxLayout(orientation="vertical")

        # ── Header ────────────────────────────────────────────────
        header = MDBoxLayout(
            orientation="vertical",
            size_hint_y=None,
            height=dp(72),
            padding=[dp(16), dp(8)],
            md_bg_color=_c("#080d1a")
        )
        header.add_widget(MDLabel(
            text="THE SYSTEM",
            font_style="H5",
            theme_text_color="Custom",
            text_color=_c(ACCENT),
            bold=True
        ))
        header.add_widget(MDLabel(
            text="Personal Operating System",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM)
        ))
        root.add_widget(header)

        # ── Scrollable body ───────────────────────────────────────
        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(10),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Stat sheet ────────────────────────────────────────────
        body.add_widget(self._section("// STAT SHEET //"))
        stats = app.db.fetchall("SELECT * FROM stats ORDER BY name")
        for s in stats:
            body.add_widget(self._stat_card(s))

        # ── Modules — 4 per row ───────────────────────────────────
        body.add_widget(self._section("// MODULES //"))
        modules = [
            ("◈ FINANCIAL",  "financial", ORANGE,    "#2a1500"),
            ("⚡ ENERGY",     "navigation", GREEN,    "#001a0d"),
            ("✦ SPIRIT",     "spirit",    GOLD,      "#1a1500"),
            ("🧠 MIND",       "navigation", ACCENT,   "#001020"),
            ("📖 KNOWLEDGE",  "navigation", "#00ff88","#001a0d"),
            ("⚔ DEXTERITY",  "navigation", "#8b5cf6","#120a2a"),
        ]

        for i in range(0, len(modules), 4):
            row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(8),
                size_hint_y=None,
                height=dp(52)
            )
            for j in range(4):
                if i + j < len(modules):
                    label, screen, color, hover = modules[i + j]
                    card = HoverCard(
                        normal_color=PANEL,
                        hover_color=hover,
                        radius=[8],
                        elevation=0,
                        padding=[dp(4), dp(6)],
                        size_hint_x=0.25
                    )
                    card.add_widget(MDLabel(
                        text=label,
                        font_style="Caption",
                        theme_text_color="Custom",
                        text_color=_c(color),
                        halign="center",
                        bold=True
                    ))
                    sc = screen
                    card.bind(on_release=lambda x, s=sc: setattr(
                        self.manager, "current", s))
                    row.add_widget(card)
                else:
                    row.add_widget(MDBoxLayout(size_hint_x=0.25))
            body.add_widget(row)

        scroll.add_widget(body)
        root.add_widget(scroll)
        root.add_widget(self._bottom_nav())
        self.add_widget(root)

    def _stat_card(self, s):
        color = STAT_COLORS.get(s["name"], ACCENT)
        rank = get_rank(s["value"])

        card = MDCard(
            orientation="horizontal",
            radius=[8], elevation=0,
            padding=[dp(14), dp(10)],
            size_hint_y=None, height=dp(60),
            md_bg_color=_c(PANEL),
            spacing=dp(12)
        )

        # Name + rank
        left = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.35
        )
        left.add_widget(MDLabel(
            text=s["name"],
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(TEXT),
            bold=True,
            size_hint_y=0.6
        ))
        rank_label = MDLabel(
            text=f"Rank {rank}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(color),
            size_hint_y=0.4
        )
        self._stat_ranks[s["name"]] = rank_label
        left.add_widget(rank_label)
        card.add_widget(left)

        # Progress bar
        mid = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.5,
            padding=[0, dp(16)]
        )
        bar = ProgressBar(
            value=s["value"],
            max=100,
            size_hint_y=None,
            height=dp(6)
        )
        self._stat_bars[s["name"]] = bar
        mid.add_widget(bar)
        card.add_widget(mid)

        # Value label
        val_label = MDLabel(
            text=str(int(s["value"])),
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(color),
            halign="right",
            bold=True,
            size_hint_x=0.15
        )
        self._stat_vals[s["name"]] = val_label
        card.add_widget(val_label)
        return card

    def _section(self, text):
        return MDLabel(
            text=text,
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None,
            height=dp(28)
        )

    def _bottom_nav(self):
        nav = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(56),
            md_bg_color=_c("#080d1a"),
            padding=[dp(8), 0]
        )
        home = MDRaisedButton(
            text="⌂  HOME",
            md_bg_color=_c(PANEL),
            size_hint_x=0.5
        )
        home.bind(on_release=lambda x: setattr(
            self.manager, "current", "navigation"))
        nav.add_widget(home)
        return nav


