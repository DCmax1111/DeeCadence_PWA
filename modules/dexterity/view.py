from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from modules.spirit.controller import SpiritController
from shared.theme import c, t, hex_color, R
from shared.components import (
    top_nav, section_label, log_row,
    empty_state, spacer, summary_card,
    input_field, primary_btn
)

PURPLE = "#8b5cf6"
GOLD = t("spirit")
GREEN = t("financial")
ACCENT = t("accent")
RED = t("error")
TEXT = t("text")
TEXT_DIM = t("text2")
PANEL = t("card")


def _c(h): return hex_color(h)  # kept for legacy hex calls

RANK_COLORS = {
    "E":  "#6B7280",
    "D":  "#22C55E",
    "C":  "#3B82F6",
    "B":  "#8B5CF6",
    "A":  "#F59E0B",
    "S":  "#F43F5E",
    "SS": "#F59E0B",
}


class DexterityScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self._built = False
        self._refresh_event = None
        self._selected_type = "Drawing"
        self._type_menu = None
        self._session_list = None
        self._type_btn = None
        self._duration = None
        self._note = None
        self._vocal_card = None

    def on_enter(self):
        if not self._built:
            app = App.get_running_app()
            self.ctrl = DexterityController(app.db)
            self._build()
            self._built = True
        else:
            self._update_data()
        self._refresh_event = Clock.schedule_interval(
            lambda dt: self._update_data(), 5)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def _update_data(self):
        self._fill_session_list()
        self._fill_vocal_card()

    def _build(self):
        from kivymd.uix.menu import MDDropdownMenu

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(top_nav(self, "⚔ DEXTERITY", "dexterity"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── VoxScope card ─────────────────────────────────────────
        body.add_widget(MDLabel(
            text="VOCAL RANGE",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(24)
        ))
        self._vocal_card_container = MDBoxLayout(
            orientation="vertical",
            size_hint_y=None, height=dp(88)
        )
        self._fill_vocal_card()
        body.add_widget(self._vocal_card_container)

        # ── Log session ───────────────────────────────────────────
        body.add_widget(MDLabel(
            text="🎨  LOG SESSION",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(32)
        ))

        self._type_btn = MDRaisedButton(
            text=f"Type: {self._selected_type}",
            md_bg_color=_c(PANEL),
            size_hint_y=None, height=dp(44)
        )
        menu_items = [
            {
                "text": t,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=t: self._set_type(x)
            }
            for t in DEXTERITY_TYPES
        ]
        self._type_menu = MDDropdownMenu(
            caller=self._type_btn,
            items=menu_items,
            width_mult=4
        )
        self._type_btn.bind(
            on_release=lambda x: self._type_menu.open())

        self._duration = MDTextField(
            hint_text="Duration (minutes)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        log_btn = MDRaisedButton(
            text="LOG SESSION",
            md_bg_color=_c(PURPLE),
            size_hint_y=None, height=dp(40)
        )
        log_btn.bind(on_release=lambda x: self._log_session())

        body.add_widget(self._type_btn)
        body.add_widget(self._duration)
        body.add_widget(self._note)
        body.add_widget(log_btn)

        body.add_widget(MDLabel(
            text="📋  RECENT SESSIONS",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(32)
        ))
        self._session_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._session_list.bind(
            minimum_height=self._session_list.setter("height"))
        self._fill_session_list()
        body.add_widget(self._session_list)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _fill_vocal_card(self):
        self._vocal_card_container.clear_widgets()
        app = App.get_running_app()
        ctrl = DexterityController(app.db)
        stats = ctrl.get_vocal_stats()

        rank = stats["rank"]
        rank_color = RANK_COLORS.get(rank, "#6B7280")

        card = MDCard(
            orientation="horizontal",
            radius=[10], elevation=0,
            padding=[dp(14), dp(12)],
            size_hint_y=None, height=dp(80),
            md_bg_color=_c("#111827"),
            spacing=dp(12)
        )
        card.bind(on_release=lambda x: setattr(
            self.manager, "current", "voxscope"))

        # Left info
        info = MDBoxLayout(orientation="vertical", size_hint_x=0.75)
        top_row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(28)
        )
        top_row.add_widget(MDLabel(
            text="🎤  Vocal Range",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c("#F1F5F9"),
            bold=True
        ))
        info.add_widget(top_row)
        info.add_widget(MDLabel(
            text=f"{stats['voice_type']}  ·  \"{stats['title']}\"",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(20)
        ))
        info.add_widget(MDLabel(
            text=f"Best: {stats['best_range']}  ·  Lvl {stats['level']}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(GOLD),
            size_hint_y=None, height=dp(20)
        ))
        card.add_widget(info)

        # Rank badge
        badge = MDCard(
            radius=[6], elevation=0,
            padding=[dp(8), dp(4)],
            size_hint_x=None, width=dp(56),
            md_bg_color=_c(rank_color + "33")
        )
        badge.add_widget(MDLabel(
            text=f"[b]{rank}[/b]",
            markup=True,
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(rank_color),
            halign="center",
            valign="middle"
        ))
        card.add_widget(badge)
        self._vocal_card_container.add_widget(card)

    def _fill_session_list(self):
        self._session_list.clear_widgets()
        for s in self.ctrl.get_recent_sessions(10):
            self._session_list.add_widget(self._log_row(
                f"{s['type']} · {s['duration']}mins",
                s["note"] or "—", s["date"],
                lambda x, id=s["id"]: self._delete(id)))

    def _log_session(self):
        ok, _ = self.ctrl.log_session(
            self._selected_type,
            self._duration.text,
            self._note.text)
        if ok:
            self._duration.text = ""
            self._note.text = ""
            self._update_data()

    def _set_type(self, type_):
        self._selected_type = type_
        self._type_btn.text = f"Type: {type_}"
        self._type_menu.dismiss()

    def _delete(self, id_):
        self.ctrl.delete_session(id_)
        self._update_data()

    def _log_row(self, title, subtitle, date, on_delete):
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(56),
            md_bg_color=_c(PANEL), spacing=dp(8))
        info = MDBoxLayout(
            orientation="vertical", size_hint_x=0.75)
        info.add_widget(MDLabel(
            text=title, font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(PURPLE), size_hint_y=0.55))
        info.add_widget(MDLabel(
            text=f"{subtitle}  ·  {date}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM), size_hint_y=0.45))
        row.add_widget(info)
        del_btn = MDFlatButton(
            text="✕", theme_text_color="Custom",
            text_color=_c(RED), size_hint_x=0.25)
        del_btn.bind(on_release=on_delete)
        row.add_widget(del_btn)
        return row

