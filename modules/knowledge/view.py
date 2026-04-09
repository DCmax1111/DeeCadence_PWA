from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.textfield import MDTextField
from kivymd.uix.button import MDRaisedButton
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from modules.knowledge.controller import KnowledgeController
from shared.theme import c, t, hex_color, R
from shared.components import (
    top_nav, section_label, log_row,
    empty_state, spacer, input_field
)


def _c(h): return hex_color(h)


class KnowledgeScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._built = False
        self._refresh_event = None
        self._reading_list = None
        self._vocab_list = None
        self._skill_list = None
        self._reading_title = None
        self._reading_pages = None
        self._reading_note = None
        self._vocab_word = None
        self._vocab_meaning = None
        self._skill_name = None
        self._skill_duration = None
        self._skill_note = None

    def on_enter(self):
        self.md_bg_color = c("bg")
        if not self._built:
            app = App.get_running_app()
            self.ctrl = KnowledgeController(app.db)
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
        self._fill_reading_list()
        self._fill_vocab_list()
        self._fill_skill_list()

    def _build(self):
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "Knowledge", "knowledge"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            padding=[dp(16), dp(14), dp(16), dp(24)],
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # Reading
        body.add_widget(
            section_label("READING", top_space=False))
        self._reading_title = input_field(
            "Book or article title")
        self._reading_pages = input_field(
            "Pages read (optional)",
            input_filter="int")
        self._reading_note = input_field(
            "Key insight (optional)")
        read_btn = MDRaisedButton(
            text="LOG READING",
            md_bg_color=_c(t("knowledge")),
            size_hint_y=None, height=dp(52)
        )
        read_btn.bind(
            on_release=lambda x: self._log_reading())
        body.add_widget(self._reading_title)
        body.add_widget(self._reading_pages)
        body.add_widget(self._reading_note)
        body.add_widget(read_btn)
        body.add_widget(spacer(6))

        self._reading_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._reading_list.bind(
            minimum_height=self._reading_list
            .setter("height"))
        self._fill_reading_list()
        body.add_widget(self._reading_list)

        # Vocabulary
        body.add_widget(section_label("VOCABULARY"))
        self._vocab_word = input_field("Word")
        self._vocab_meaning = input_field(
            "Meaning / Definition")
        vocab_btn = MDRaisedButton(
            text="ADD WORD",
            md_bg_color=_c(t("knowledge")),
            size_hint_y=None, height=dp(52)
        )
        vocab_btn.bind(
            on_release=lambda x: self._log_vocab())
        body.add_widget(self._vocab_word)
        body.add_widget(self._vocab_meaning)
        body.add_widget(vocab_btn)
        body.add_widget(spacer(6))

        self._vocab_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._vocab_list.bind(
            minimum_height=self._vocab_list
            .setter("height"))
        self._fill_vocab_list()
        body.add_widget(self._vocab_list)

        # Skills
        body.add_widget(section_label("SKILLS"))
        self._skill_name = input_field(
            "Skill practiced")
        self._skill_duration = input_field(
            "Duration (minutes)",
            input_filter="int")
        self._skill_note = input_field(
            "Note (optional)")
        skill_btn = MDRaisedButton(
            text="LOG SKILL",
            md_bg_color=_c(t("knowledge")),
            size_hint_y=None, height=dp(52)
        )
        skill_btn.bind(
            on_release=lambda x: self._log_skill())
        body.add_widget(self._skill_name)
        body.add_widget(self._skill_duration)
        body.add_widget(self._skill_note)
        body.add_widget(skill_btn)
        body.add_widget(spacer(6))

        self._skill_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._skill_list.bind(
            minimum_height=self._skill_list
            .setter("height"))
        self._fill_skill_list()
        body.add_widget(self._skill_list)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _fill_reading_list(self):
        self._reading_list.clear_widgets()
        items = self.ctrl.get_recent_reading(5)
        if not items:
            self._reading_list.add_widget(
                empty_state("No reading logged yet"))
            return
        for r in items:
            self._reading_list.add_widget(log_row(
                r["title"],
                f"{r['pages']} pages"
                f"  ·  {r['note'] or '—'}"
                f"  ·  {r['date']}",
                "knowledge"
            ))

    def _fill_vocab_list(self):
        self._vocab_list.clear_widgets()
        items = self.ctrl.get_recent_vocab(8)
        if not items:
            self._vocab_list.add_widget(
                empty_state("No words added yet"))
            return
        for v in items:
            self._vocab_list.add_widget(log_row(
                v["word"], v["meaning"],
                "knowledge"
            ))

    def _fill_skill_list(self):
        self._skill_list.clear_widgets()
        items = self.ctrl.get_recent_skills(5)
        if not items:
            self._skill_list.add_widget(
                empty_state("No skills logged yet"))
            return
        for s in items:
            self._skill_list.add_widget(log_row(
                f"{s['skill']}  ·  {s['duration']}mins",
                f"{s['note'] or '—'}  ·  {s['date']}",
                "knowledge"
            ))

    def _log_reading(self):
        ok, _ = self.ctrl.log_reading(
            self._reading_title.text,
            self._reading_pages.text,
            self._reading_note.text)
        if ok:
            self._reading_title.text = ""
            self._reading_pages.text = ""
            self._reading_note.text = ""
            self._update_data()

    def _log_vocab(self):
        ok, _ = self.ctrl.log_vocab(
            self._vocab_word.text,
            self._vocab_meaning.text)
        if ok:
            self._vocab_word.text = ""
            self._vocab_meaning.text = ""
            self._update_data()

    def _log_skill(self):
        ok, _ = self.ctrl.log_skill(
            self._skill_name.text,
            self._skill_duration.text,
            self._skill_note.text)
        if ok:
            self._skill_name.text = ""
            self._skill_duration.text = ""
            self._skill_note.text = ""
            self._update_data()

