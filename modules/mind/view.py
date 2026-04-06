from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from modules.mind.controller import MindController, FOCUS_TYPES
from shared.theme import c, t, hex_color, R
from shared.components import (
    top_nav, section_label, log_row,
    empty_state, spacer, input_field
)


def _c(h): return hex_color(h)

PURPLE = t("mind")


class MindScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
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
        self.md_bg_color = c("bg")
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
        root.add_widget(top_nav(self, "Mind", "mind"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            padding=[dp(16), dp(14), dp(16), dp(24)],
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # Focus sessions
        body.add_widget(
            section_label("FOCUS SESSIONS",
                         top_space=False))
        self._focus_type_btn = MDRaisedButton(
            text=f"Type: {self._selected_focus_type}",
            md_bg_color=c("card"),
            size_hint_y=None, height=dp(52)
        )
        menu_items = [
            {
                "text": ft,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=ft:
                    self._set_focus_type(x)
            }
            for ft in FOCUS_TYPES
        ]
        self._focus_menu = MDDropdownMenu(
            caller=self._focus_type_btn,
            items=menu_items,
            width_mult=4
        )
        self._focus_type_btn.bind(
            on_release=lambda x:
                self._focus_menu.open())
        body.add_widget(self._focus_type_btn)

        self._focus_duration = input_field(
            "Duration (minutes)",
            input_filter="int")
        self._focus_note = input_field(
            "Note (optional)")
        focus_btn = MDRaisedButton(
            text="LOG FOCUS SESSION",
            md_bg_color=_c(t("mind")),
            size_hint_y=None, height=dp(52)
        )
        focus_btn.bind(
            on_release=lambda x: self._log_focus())
        body.add_widget(self._focus_duration)
        body.add_widget(self._focus_note)
        body.add_widget(focus_btn)
        body.add_widget(spacer(6))

        self._focus_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._focus_list.bind(
            minimum_height=self._focus_list
            .setter("height"))
        self._fill_focus_list()
        body.add_widget(self._focus_list)

        # Mood
        body.add_widget(section_label("MOOD CHECK-IN"))
        self._mood_score = input_field(
            "Mood score 1-5",
            input_filter="int")
        self._mood_energy = input_field(
            "Energy score 1-5",
            input_filter="int")
        self._mood_note = input_field(
            "Note (optional)")
        mood_btn = MDRaisedButton(
            text="LOG MOOD",
            md_bg_color=_c(t("mind")),
            size_hint_y=None, height=dp(52)
        )
        mood_btn.bind(
            on_release=lambda x: self._log_mood())
        body.add_widget(self._mood_score)
        body.add_widget(self._mood_energy)
        body.add_widget(self._mood_note)
        body.add_widget(mood_btn)
        body.add_widget(spacer(6))

        self._mood_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._mood_list.bind(
            minimum_height=self._mood_list
            .setter("height"))
        self._fill_mood_list()
        body.add_widget(self._mood_list)

        # Journal
        body.add_widget(section_label("JOURNAL"))
        self._journal_content = input_field(
            "Write your thoughts...",
            multiline=True,
            height=dp(100))
        journal_btn = MDRaisedButton(
            text="SAVE ENTRY",
            md_bg_color=_c(t("financial")),
            size_hint_y=None, height=dp(52)
        )
        journal_btn.bind(
            on_release=lambda x: self._log_journal())
        body.add_widget(self._journal_content)
        body.add_widget(journal_btn)
        body.add_widget(spacer(6))

        self._journal_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._journal_list.bind(
            minimum_height=self._journal_list
            .setter("height"))
        self._fill_journal_list()
        body.add_widget(self._journal_list)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _fill_focus_list(self):
        self._focus_list.clear_widgets()
        items = self.ctrl.get_recent_focus(5)
        if not items:
            self._focus_list.add_widget(
                empty_state("No focus sessions yet"))
            return
        for f in items:
            self._focus_list.add_widget(log_row(
                f"{f['type']}  ·  {f['duration']}mins",
                f"{f['note'] or '—'}  ·  {f['date']}",
                "mind"
            ))

    def _fill_mood_list(self):
        self._mood_list.clear_widgets()
        items = self.ctrl.get_recent_mood(5)
        if not items:
            self._mood_list.add_widget(
                empty_state("No mood entries yet"))
            return
        for m in items:
            self._mood_list.add_widget(log_row(
                f"Mood {m['score']}/5  ·  "
                f"Energy {m['energy']}/5",
                f"{m['note'] or '—'}  ·  {m['date']}",
                "mind"
            ))

    def _fill_journal_list(self):
        self._journal_list.clear_widgets()
        items = self.ctrl.get_recent_journal(5)
        if not items:
            self._journal_list.add_widget(
                empty_state("No journal entries yet"))
            return
        for j in items:
            preview = j["content"][:60] + (
                "..." if len(j["content"]) > 60 else "")
            self._journal_list.add_widget(log_row(
                preview, j["date"], "financial"
            ))

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
        ok, _ = self.ctrl.log_journal(
            self._journal_content.text)
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

