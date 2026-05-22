from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.card import MDCard
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from kivy.graphics import Color, RoundedRectangle, Line
from kivy.clock import Clock
from shared.theme import (
    c, t, hex_color, get_rank,
    stat_color, rank_color, R
)
from shared.components import (
    ModuleCard, section_label,
    ThemeToggle, spacer, get_greeting
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
        "desc":      "Focus · Clarity · DeeCadence",
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
        "desc":      "Drawing · Design · VoxScope",
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
        self._date_label = None
        self._overall_label = None
        self._key_stats_labels = {}
        self._refresh_event = None

    def on_enter(self):
        self.md_bg_color = c("bg")
        if not self._built:
            self._build()
            self._built = True
        else:
            self._refresh()
        # Refresh every 10s on home
        self._refresh_event = Clock.schedule_interval(
            lambda dt: self._refresh(), 10)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def _refresh(self):
        app = App.get_running_app()
        try:
            stats = {s["name"]: dict(s) for s in
                     app.db.fetchall("SELECT * FROM stats")}
        except Exception:
            return

        # Greeting
        if self._greeting_label:
            name = getattr(app, 'user_name', 'DC')
            self._greeting_label.text = get_greeting(name)

        # Date
        if self._date_label:
            self._date_label.text = (
                datetime.datetime.now()
                .strftime("%A, %d %B %Y"))

        # Overall rank
        if self._overall_label and stats:
            avg = (sum(s["value"]
                       for s in stats.values()) /
                   len(stats))
            overall = get_rank(avg)
            self._overall_label.text = (
                f"Rank {overall}  ·  "
                f"Score {int(avg)}")
            self._overall_label.color = (
                _c(rank_color(overall)))

        # Key stat labels
        for sname, lbl in self._key_stats_labels.items():
            sd = stats.get(sname, {})
            val = int(sd.get("value", 1))
            lbl.text = f"{sname}  {val}"
            lbl.color = _c(stat_color(sname))

        # Module cards
        for m in MODULES:
            sd = stats.get(m["stat"], {})
            val = int(sd.get("value", 1))
            rank = get_rank(sd.get("value", 1))
            key = m["screen"]
            if key in self._module_cards:
                self._module_cards[key].update_stat(
                    f"{val} · Rank {rank}")

    def _build(self):
        app = App.get_running_app()
        try:
            stats = {s["name"]: dict(s) for s in
                     app.db.fetchall("SELECT * FROM stats")}
        except Exception:
            stats = {}

        avg = (sum(s["value"]
                   for s in stats.values()) /
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
        header.add_widget(MDLabel(
            text="DEE_CISTEM",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(t("accent")),
            bold=True,
            size_hint_x=0.75
        ))
        toggle = ThemeToggle(
            on_toggle=self._on_theme_change)
        header.add_widget(toggle)
        root.add_widget(header)

        # ── Scroll body ───────────────────────────────────────────
        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(20), dp(20),
                     dp(20), dp(32)],
            spacing=dp(0),
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
            height=dp(44)
        )
        body.add_widget(self._greeting_label)

        self._date_label = MDLabel(
            text=datetime.datetime.now()
            .strftime("%A, %d %B %Y"),
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None,
            height=dp(20)
        )
        body.add_widget(self._date_label)
        body.add_widget(spacer(24))

        # ── Stat dashboard card ───────────────────────────────────
        dash_card = MDCard(
            orientation="vertical",
            radius=R["lg"],
            elevation=0,
            padding=[dp(18), dp(16)],
            size_hint_y=None,
            height=dp(112),
            md_bg_color=c("card")
        )

        # Top row — label + arrow
        dash_top = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(22)
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
            font_size="18sp",
            theme_text_color="Custom",
            text_color=c("text3"),
            halign="right"
        ))
        dash_card.add_widget(dash_top)
        dash_card.add_widget(spacer(4))

        # Overall rank
        self._overall_label = MDLabel(
            text=f"Rank {overall}  ·  "
                 f"Score {int(avg)}",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(rank_color(overall)),
            bold=True,
            size_hint_y=None,
            height=dp(32)
        )
        dash_card.add_widget(self._overall_label)
        dash_card.add_widget(spacer(8))

        # 3 key stats row
        key_stats = ["Body", "Mind", "Spirit"]
        stats_row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(20),
            spacing=dp(20)
        )
        self._key_stats_labels = {}
        for sname in key_stats:
            sd = stats.get(sname, {})
            val = int(sd.get("value", 1))
            col = stat_color(sname)
            lbl = MDLabel(
                text=f"{sname}  {val}",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=_c(col)
            )
            self._key_stats_labels[sname] = lbl
            stats_row.add_widget(lbl)
        dash_card.add_widget(stats_row)

        dash_card.bind(on_release=lambda x: setattr(
            self.manager, "current", "dashboard"))
        body.add_widget(dash_card)
        body.add_widget(spacer(28))

        # ── Modules ───────────────────────────────────────────────
        body.add_widget(
            section_label("MODULES", top_space=False))
        body.add_widget(spacer(10))

        for i in range(0, len(MODULES), 2):
            pair = MODULES[i:i+2]
            is_odd = len(pair) == 1

            row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(10),
                size_hint_y=None,
                height=dp(100)
            )

            if is_odd:
                row.add_widget(
                    Widget(size_hint_x=0.5))

            for m in pair:
                sd = stats.get(m["stat"], {})
                val = int(sd.get("value", 1))
                rank = get_rank(sd.get("value", 1))

                card = ModuleCard(
                    label=m["label"],
                    desc=m["desc"],
                    stat_text=f"{val} · Rank {rank}",
                    color_key=m["color_key"],
                    hover_hex=m["hover"],
                    size_hint_x=0.5
                )
                sc = m["screen"]
                def _go(screen_key):
                    app = App.get_running_app()
                    if app.gate.can_access_module(screen_key):
                        self.manager.current = screen_key
                    else:
                        locked = self.manager.get_screen(
                            "locked_module")
                        locked.set_module(screen_key)
                        self.manager.current = "locked_module"

                card.bind(on_release=lambda x, s=sc: _go(s))
                self._module_cards[m["screen"]] = card
                row.add_widget(card)

            if is_odd:
                row.add_widget(
                    Widget(size_hint_x=0.5))

            body.add_widget(row)
            body.add_widget(spacer(10))
        
        # Settings link
        settings_card = MDCard(
            orientation="horizontal",
            radius=R["lg"], elevation=0,
            padding=[dp(18), dp(16)],
            size_hint_y=None, height=dp(52),
            md_bg_color=c("card")
        )
        settings_card.add_widget(MDLabel(
            text="Settings",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=c("text2")
        ))
        settings_card.add_widget(MDLabel(
            text=">",
            font_size="18sp",
            theme_text_color="Custom",
            text_color=c("text3"),
            halign="right"
        ))
        settings_card.bind(on_release=lambda x: setattr(
            self.manager, "current", "settings"))
        body.add_widget(settings_card)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _on_theme_change(self):
        self._built = False
        self.clear_widgets()
        self.md_bg_color = c("bg")
        self._build()
        self._built = True

