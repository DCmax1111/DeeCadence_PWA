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
from modules.knowledge.controller import KnowledgeController
from shared.theme import (
    GREEN, RED, PANEL, TEXT,
    TEXT_DIM, hex_color
)
from shared.components import top_nav

KNOWLEDGE_GREEN = "#00ff88"


def _c(h): return hex_color(h)


class KnowledgeScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
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
            top_nav(self, "📖  KNOWLEDGE", KNOWLEDGE_GREEN))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Reading ───────────────────────────────────────────────
        body.add_widget(self._section("📚  READING"))
        self._reading_title = MDTextField(
            hint_text="Book or article title",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        self._reading_pages = MDTextField(
            hint_text="Pages read (optional)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        self._reading_note = MDTextField(
            hint_text="Key insight (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        read_btn = MDRaisedButton(
            text="LOG READING",
            md_bg_color=_c(KNOWLEDGE_GREEN),
            size_hint_y=None, height=dp(40))
        read_btn.bind(on_release=lambda x: self._log_reading())
        body.add_widget(self._reading_title)
        body.add_widget(self._reading_pages)
        body.add_widget(self._reading_note)
        body.add_widget(read_btn)

        self._reading_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._reading_list.bind(
            minimum_height=self._reading_list.setter("height"))
        self._fill_reading_list()
        body.add_widget(self._reading_list)

        # ── Vocabulary ────────────────────────────────────────────
        body.add_widget(self._section("🔤  VOCABULARY"))
        self._vocab_word = MDTextField(
            hint_text="Word",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        self._vocab_meaning = MDTextField(
            hint_text="Meaning / Definition",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        vocab_btn = MDRaisedButton(
            text="ADD WORD",
            md_bg_color=_c(KNOWLEDGE_GREEN),
            size_hint_y=None, height=dp(40))
        vocab_btn.bind(on_release=lambda x: self._log_vocab())
        body.add_widget(self._vocab_word)
        body.add_widget(self._vocab_meaning)
        body.add_widget(vocab_btn)

        self._vocab_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._vocab_list.bind(
            minimum_height=self._vocab_list.setter("height"))
        self._fill_vocab_list()
        body.add_widget(self._vocab_list)

        # ── Skills ────────────────────────────────────────────────
        body.add_widget(self._section("⚙  SKILLS"))
        self._skill_name = MDTextField(
            hint_text="Skill practiced",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        self._skill_duration = MDTextField(
            hint_text="Duration (minutes)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        self._skill_note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44))
        skill_btn = MDRaisedButton(
            text="LOG SKILL",
            md_bg_color=_c(KNOWLEDGE_GREEN),
            size_hint_y=None, height=dp(40))
        skill_btn.bind(on_release=lambda x: self._log_skill())
        body.add_widget(self._skill_name)
        body.add_widget(self._skill_duration)
        body.add_widget(self._skill_note)
        body.add_widget(skill_btn)

        self._skill_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._skill_list.bind(
            minimum_height=self._skill_list.setter("height"))
        self._fill_skill_list()
        body.add_widget(self._skill_list)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _fill_reading_list(self):
        self._reading_list.clear_widgets()
        for r in self.ctrl.get_recent_reading(5):
            self._reading_list.add_widget(self._log_row(
                r["title"],
                f"{r['pages']} pages  ·  {r['note'] or '—'}",
                r["date"], KNOWLEDGE_GREEN,
                lambda x, id=r["id"]: self._delete_reading(id)))

    def _fill_vocab_list(self):
        self._vocab_list.clear_widgets()
        for v in self.ctrl.get_recent_vocab(8):
            self._vocab_list.add_widget(self._log_row(
                v["word"], v["meaning"],
                v["date"], KNOWLEDGE_GREEN,
                lambda x, id=v["id"]: self._delete_vocab(id)))

    def _fill_skill_list(self):
        self._skill_list.clear_widgets()
        for s in self.ctrl.get_recent_skills(5):
            self._skill_list.add_widget(self._log_row(
                f"{s['skill']} · {s['duration']}mins",
                s["note"] or "—", s["date"], KNOWLEDGE_GREEN,
                lambda x, id=s["id"]: self._delete_skill(id)))

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

    def _delete_reading(self, id_):
        self.ctrl.delete_reading(id_)
        self._update_data()

    def _delete_vocab(self, id_):
        self.ctrl.delete_vocab(id_)
        self._update_data()

    def _delete_skill(self, id_):
        self.ctrl.delete_skill(id_)
        self._update_data()

    def _log_row(self, title, subtitle, date, color, on_delete):
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
