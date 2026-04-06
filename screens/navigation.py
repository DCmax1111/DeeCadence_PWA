from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.card import MDCard
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from kivy.graphics import Color, RoundedRectangle, Line
from shared.theme import (
    c, t, hex_color, get_rank,
    stat_color, rank_color, R
)
from shared.components import (
    ModuleCard, section_label, ThemeToggle,
    rank_badge, spacer, get_greeting
)
import datetime


def _c(h): return hex_color(h)


MODULES = [
    {
        "label":     "Financial",
        "screen":    "financial",
        "color_key": "financial",
        "desc":      "Income · Expenses · Cashflow",
        "stat":      "Financial",
        "hover":     "#0D2B1E",
    },
    {
        "label":     "Spirit",
        "screen":    "spirit",
        "color_key": "spirit",
        "desc":      "Prayer · Bible · Leadership",
        "stat":      "Spirit",
        "hover":     "#2B1E00",
    },
    {
        "label":     "Mind",
        "screen":    "mind",
        "color_key": "mind",
        "desc":      "Focus · Clarity · Journal",
        "stat":      "Mind",
        "hover":     "#1A0D2E",
    },
    {
        "label":     "Knowledge",
        "screen":    "knowledge",
        "color_key": "knowledge",
        "desc":      "Study · Reading · Skills",
        "stat":      "Knowledge",
        "hover":     "#0D2B1E",
    },
    {
        "label":     "Dexterity",
        "screen":    "dexterity",
        "color_key": "dexterity",
        "desc":      "Drawing · Design · Craft",
        "stat":      "Dexterity",
        "hover":     "#2B0D1E",
    },
    {
        "label":     "Energy",
        "screen":    "energy",
        "color_key": "energy",
        "desc":      "Sleep · Water · Exercise",
        "stat":      "Body",
        "hover":     "#0A1A2E",
    },
]


class NavigationScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._built = False
        self._module_cards = {}
        self._greeting_label = None
        self._overall_label = None

    def on_enter(self):
        self.md_bg_color = c("bg")
        if not self._built:
            self._build()
            self._built = True
        else:
            self._refresh()

    def _refresh(self):
        app = App.get_running_app()
        stats = {s["name"]: dict(s)
                 for s in app.db.fetchall("SELECT * FROM stats")}

        # Update greeting
        if self._greeting_label:
            name = getattr(app, 'user_name', 'DC')
            self._greeting_label.text = get_greeting(name)

        # Update module cards
        for m in MODULES:
            stat_data = stats.get(m["stat"], {})
            val = int(stat_data.get("value", 1))
            rank = stat_data.get("rank", "E")
            key = m["screen"]
            if key in self._module_cards:
                self._module_cards[key].update_stat(
                    f"{val} · Rank {rank}")

        # Update overall rank
        if self._overall_label and stats:
            avg = sum(s["value"]
                      for s in stats.values()) / len(stats)
            overall = get_rank(avg)
            self._overall_label.text = (
                f"Rank {overall}  ·  Score {int(avg)}")
            self._overall_label.color = _c(rank_color(overall))

    def _build(self):
        app = App.get_running_app()
        stats = {s["name"]: dict(s)
                 for s in app.db.fetchall("SELECT * FROM stats")}
        avg = (sum(s["value"] for s in stats.values()) /
               max(1, len(stats)))
        overall = get_rank(avg)
        name = getattr(app, 'user_name', 'DC')

        root = MDBoxLayout(orientation="vertical")

        # ── Fixed header ──────────────────────────────────────────
        header = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(56),
            padding=[dp(20), 0, dp(16), 0],
            md_bg_color=c("bg2")
        )
        title = MDLabel(
            text="DEE_CISTEM",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(t("accent")),
            bold=True,
            size_hint_x=0.75
        )
        header.add_widget(title)
        toggle = ThemeToggle(
            on_toggle=self._on_theme_change)
        header.add_widget(toggle)
        root.add_widget(header)

        # ── Scrollable body ───────────────────────────────────────
        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(0),
            padding=[dp(16), dp(20), dp(16), dp(24)],
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Greeting ──────────────────────────────────────────────
        self._greeting_label = MDLabel(
            text=get_greeting(name),
            font_style="H5",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=None,
            height=dp(40)
        )
        body.add_widget(self._greeting_label)

        date_str = datetime.datetime.now().strftime(
            "%A, %d %B %Y")
        body.add_widget(MDLabel(
            text=date_str,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None,
            height=dp(20)
        ))

        body.add_widget(spacer(20))

        # ── Stat dashboard card ───────────────────────────────────
        dash_card = MDCard(
            orientation="vertical",
            radius=R["lg"],
            elevation=0,
            padding=[dp(18), dp(16)],
            size_hint_y=None,
            height=dp(100),
            md_bg_color=c("card")
        )

        dash_top = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(32)
        )
        dash_top.add_widget(MDLabel(
            text="STAT DASHBOARD",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=c("text3"),
            bold=True
        ))
        dash_top.add_widget(MDLabel(
            text=">",
            font_size="20sp",
            theme_text_color="Custom",
            text_color=c("text3"),
            halign="right"
        ))
        dash_card.add_widget(dash_top)

        self._overall_label = MDLabel(
            text=f"Rank {overall}  ·  Score {int(avg)}",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(rank_color(overall)),
            bold=True,
            size_hint_y=None,
            height=dp(36)
        )
        dash_card.add_widget(self._overall_label)

        # 3 key stats inline
        key_stats = ["Body", "Mind", "Spirit"]
        stats_row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(20),
            spacing=dp(16)
        )
        for sname in key_stats:
            sd = stats.get(sname, {})
            val = int(sd.get("value", 1))
            col = stat_color(sname)
            stats_row.add_widget(MDLabel(
                text=f"{sname} {val}",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=_c(col)
            ))
        dash_card.add_widget(stats_row)
        dash_card.bind(on_release=lambda x: setattr(
            self.manager, "current", "dashboard"))
        body.add_widget(dash_card)

        body.add_widget(spacer(20))

        # ── Modules ───────────────────────────────────────────────
        body.add_widget(section_label(
            "MODULES", top_space=False))
        body.add_widget(spacer(8))

        for i in range(0, len(MODULES), 2):
            pair = MODULES[i:i+2]
            is_odd = len(pair) == 1

            row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(10),
                size_hint_y=None,
                height=dp(96)
            )

            if is_odd:
                row.add_widget(Widget(size_hint_x=0.5))

            for m in pair:
                sd = stats.get(m["stat"], {})
                val = int(sd.get("value", 1))
                rank = sd.get("rank", "E")

                card = ModuleCard(
                    label=m["label"],
                    desc=m["desc"],
                    stat_text=f"{val} · Rank {rank}",
                    color_key=m["color_key"],
                    hover_hex=m["hover"],
                    size_hint_x=0.5
                )
                sc = m["screen"]
                card.bind(on_release=lambda x, s=sc: setattr(
                    self.manager, "current", s))
                self._module_cards[m["screen"]] = card
                row.add_widget(card)

            if is_odd:
                row.add_widget(Widget(size_hint_x=0.5))

            body.add_widget(row)
            body.add_widget(spacer(10))

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _on_theme_change(self):
        self._built = False
        self.clear_widgets()
        self.md_bg_color = c("bg")
        self._build()
        self._built = True

