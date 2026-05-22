from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.card import MDCard
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from shared.theme import (
    c, t, hex_color, get_rank,
    stat_color, rank_color, R
)
from shared.components import (
    StatBarCard, section_label,
    top_nav, spacer
)


def _c(h): return hex_color(h)


class DashboardScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._built = False
        self._stat_cards = {}
        self._refresh_event = None
        self._rank_lbl = None
        self._score_lbl = None

    def on_enter(self):
        self.md_bg_color = c("bg")
        if not self._built:
            self._build()
            self._built = True
        else:
            self._update_stats()
        self._refresh_event = Clock.schedule_interval(
            lambda dt: self._update_stats(), 5)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def _update_stats(self):
        app = App.get_running_app()
        rows = app.db.fetchall(
            "SELECT * FROM stats ORDER BY name")
        total = 0
        for s in rows:
            name = s["name"]
            val = s["value"]
            total += val
            rank = get_rank(val)
            color = stat_color(name)
            if name in self._stat_cards:
                self._stat_cards[name].update(
                    val, rank, color)
        avg = total / max(1, len(rows))
        overall = get_rank(avg)
        if self._rank_lbl:
            self._rank_lbl.text = overall
            self._rank_lbl.color = _c(rank_color(overall))
        if self._score_lbl:
            self._score_lbl.text = (
                f"Average score: {int(avg)}")

    def _build(self):
        app = App.get_running_app()
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "STAT DASHBOARD", "accent"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            padding=[dp(16), dp(16), dp(16), dp(24)],
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # Overall rank card
        rows = app.db.fetchall("SELECT * FROM stats")
        avg = (sum(s["value"] for s in rows) /
               max(1, len(rows)))
        overall = get_rank(avg)
        rc = rank_color(overall)

        overall_card = MDCard(
            orientation="horizontal",
            radius=R["lg"],
            elevation=0,
            padding=[dp(18), dp(16)],
            size_hint_y=None, height=dp(88),
            md_bg_color=c("card"),
            spacing=dp(16)
        )

        badge = MDCard(
            radius=R["md"],
            elevation=0,
            padding=[dp(4), dp(4)],
            size_hint=(None, None),
            size=(dp(56), dp(56)),
            md_bg_color=_c(rc + "22")
        )
        self._rank_lbl = MDLabel(
            text=overall,
            font_style="H4",
            theme_text_color="Custom",
            text_color=_c(rc),
            halign="center",
            valign="middle",
            bold=True
        )
        badge.add_widget(self._rank_lbl)
        overall_card.add_widget(badge)

        right = MDBoxLayout(orientation="vertical")
        right.add_widget(MDLabel(
            text="OVERALL RANK",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=0.35
        ))
        self._score_lbl = MDLabel(
            text=f"Average score: {int(avg)}",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=0.65
        )
        right.add_widget(self._score_lbl)
        overall_card.add_widget(right)
        body.add_widget(overall_card)
        body.add_widget(spacer(8))

        # Stats
        body.add_widget(
            section_label("STAT SHEET", top_space=False))
        body.add_widget(spacer(4))

        stats_sorted = app.db.fetchall(
            "SELECT * FROM stats ORDER BY name")
        for s in stats_sorted:
            name = s["name"]
            val = s["value"]
            rank = get_rank(val)
            color = stat_color(name)
            card = StatBarCard(
                stat_name=name,
                value=val,
                color_hex=color,
                rank=rank
            )
            self._stat_cards[name] = card
            body.add_widget(card)
            body.add_widget(spacer(6))

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

