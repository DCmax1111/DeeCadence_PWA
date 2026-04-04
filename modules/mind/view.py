from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.card import MDCard
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from modules.mind.controller import MindController, FOCUS_TYPES
from shared.theme import (
    ACCENT, GREEN, RED, PANEL,
    TEXT, TEXT_DIM, hex_color
)
from shared.components import top_nav

PURPLE = "#8b5cf6"


def _c(h): return hex_color(h)


class MindScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self._built = False
        self._refresh_event = None
        self._selected_focus_type = "Deep Work"
        self._focus_menu = None

        self._focus_list = None
        self._mood_list = None
        self._journal_list = None

        self._focus_duration = None
        self._focus_type_btn = None
        self._focus_note = None
        self._mood_score = None
        self._mood_energy = None
        self._mood_note = None
        self._journal_content = None

    def on_enter(self):
        if not self._built:
            app = App.get_running_app()
            self.ctrl = MindController(app.db)
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
        self._fill_focus_list()
        self._fill_mood_list()
        self._fill_journal_list()

    def _build(self):
        from kivymd.uix.menu import MDDropdownMenu

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(top_nav(self, "🧠  MIND", ACCENT))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Focus ─────────────────────────────────────────────────
        body.add_widget(self._section("🎯  FOCUS SESSIONS"))
        self._focus_type_btn = MDRaisedButton(
            text=f"Type: {self._selected_focus_type}",
            md_bg_color=_c(PANEL),
            size_hint_y=None, height=dp(44)
        )
        menu_items = [
            {
                "text": t,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=t: self._set_focus_type(x)
            }
            for t in FOCUS_TYPES
        ]
        self._focus_menu = MDDropdownMenu(
            caller=self._focus_type_btn,
            items=menu_items,
            width_mult=4
        )
        self._focus_type_btn.bind(
            on_release=lambda x: self._focus_menu.open())
        body.add_widget(self._focus_type_btn)

        self._focus_duration = MDTextField(
            hint_text="Duration (minutes)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._focus_note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        focus_btn = MDRaisedButton(
            text="LOG FOCUS SESSION",
            md_bg_color=_c(ACCENT),
            size_hint_y=None, height=dp(40)
        )
        focus_btn.bind(on_release=lambda x: self._log_focus())
        body.add_widget(self._focus_duration)
        body.add_widget(self._focus_note)
        body.add_widget(focus_btn)

        self._focus_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._focus_list.bind(
            minimum_height=self._focus_list.setter("height"))
        self._fill_focus_list()
        body.add_widget(self._focus_list)

        # ── Mood ──────────────────────────────────────────────────
        body.add_widget(self._section("🌡  MOOD CHECK-IN"))
        self._mood_score = MDTextField(
            hint_text="Mood score 1-5",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._mood_energy = MDTextField(
            hint_text="Energy score 1-5",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._mood_note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        mood_btn = MDRaisedButton(
            text="LOG MOOD",
            md_bg_color=_c(PURPLE),
            size_hint_y=None, height=dp(40)
        )
        mood_btn.bind(on_release=lambda x: self._log_mood())
        body.add_widget(self._mood_score)
        body.add_widget(self._mood_energy)
        body.add_widget(self._mood_note)
        body.add_widget(mood_btn)

        self._mood_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._mood_list.bind(
            minimum_height=self._mood_list.setter("height"))
        self._fill_mood_list()
        body.add_widget(self._mood_list)

        # ── Journal ───────────────────────────────────────────────
        body.add_widget(self._section("📓  JOURNAL"))
        self._journal_content = MDTextField(
            hint_text="Write your thoughts...",
            mode="rectangle",
            multiline=True,
            size_hint_y=None, height=dp(100)
        )
        journal_btn = MDRaisedButton(
            text="SAVE ENTRY",
            md_bg_color=_c(GREEN),
            size_hint_y=None, height=dp(40)
        )
        journal_btn.bind(on_release=lambda x: self._log_journal())
        body.add_widget(self._journal_content)
        body.add_widget(journal_btn)

        self._journal_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._journal_list.bind(
            minimum_height=self._journal_list.setter("height"))
        self._fill_journal_list()
        body.add_widget(self._journal_list)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _fill_focus_list(self):
        self._focus_list.clear_widgets()
        for f in self.ctrl.get_recent_focus(5):
            self._focus_list.add_widget(self._log_row(
                f"{f['type']} · {f['duration']}mins",
                f["note"] or "—", f["date"], ACCENT,
                lambda x, id=f["id"]: self._delete_focus(id)))

    def _fill_mood_list(self):
        self._mood_list.clear_widgets()
        for m in self.ctrl.get_recent_mood(5):
            self._mood_list.add_widget(self._log_row(
                f"Mood {m['score']}/5 · Energy {m['energy']}/5",
                m["note"] or "—", m["date"], PURPLE,
                lambda x, id=m["id"]: self._delete_mood(id)))

    def _fill_journal_list(self):
        self._journal_list.clear_widgets()
        for j in self.ctrl.get_recent_journal(5):
            preview = j["content"][:60] + (
                "..." if len(j["content"]) > 60 else "")
            self._journal_list.add_widget(self._log_row(
                preview, j["date"], j["date"], GREEN,
                lambda x, id=j["id"]: self._delete_journal(id)))

    def _log_focus(self):
        ok, _ = self.ctrl.log_focus(
            self._focus_duration.text,
            self._selected_focus_type,
            self._focus_note.text)
        if ok:
            self._focus_duration.text = ""
            self._focus_note.text = ""
            self._update_data()

    def _log_mood(self):
        ok, _ = self.ctrl.log_mood(
            self._mood_score.text,
            self._mood_energy.text,
            self._mood_note.text)
        if ok:
            self._mood_score.text = ""
            self._mood_energy.text = ""
            self._mood_note.text = ""
            self._update_data()

    def _log_journal(self):
        ok, _ = self.ctrl.log_journal(self._journal_content.text)
        if ok:
            self._journal_content.text = ""
            self._update_data()

    def _set_focus_type(self, type_):
        self._selected_focus_type = type_
        self._focus_type_btn.text = f"Type: {type_}"
        self._focus_menu.dismiss()

    def _delete_focus(self, id_):
        self.ctrl.delete_focus(id_)
        self._update_data()

    def _delete_mood(self, id_):
        self.ctrl.delete_mood(id_)
        self._update_data()

    def _delete_journal(self, id_):
        self.ctrl.delete_journal(id_)
        self._update_data()

    def _log_row(self, title, subtitle, date, color, on_delete):
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(56),
            md_bg_color=_c(PANEL), spacing=dp(8)
        )
        info = MDBoxLayout(
            orientation="vertical", size_hint_x=0.75)
        info.add_widget(MDLabel(
            text=title, font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(color), size_hint_y=0.55))
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

    def _section(self, text):
        return MDLabel(
            text=text, font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(32))
