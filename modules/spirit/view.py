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
from modules.spirit.controller import SpiritController
from shared.components import top_nav
from shared.theme import (
    GOLD, PANEL, TEXT, TEXT_DIM,
    ACCENT, GREEN, RED, hex_color
)

PURPLE = "#8b5cf6"


def _c(h): return hex_color(h)


class SpiritScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self._refresh_event = None
        self._built = False

        # Dynamic containers — cleared/refilled on refresh
        self._prayer_list = None
        self._bible_list = None
        self._meditation_list = None
        self._event_list = None
        self._note_list = None
        self._summary_row = None

        # Input field references — preserved across refreshes
        self._prayer_note = None
        self._bible_passage = None
        self._bible_note = None
        self._med_duration = None
        self._med_note = None
        self._event_title = None
        self._event_date = None
        self._event_notes = None
        self._note_title = None
        self._note_content = None

    def on_enter(self):
        if not self._built:
            app = App.get_running_app()
            self.ctrl = SpiritController(app.db)
            self._build()
            self._built = True
        else:
            self._update_data()
        self._refresh_event = Clock.schedule_interval(
            lambda dt: self._update_data(), 5
        )

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def _update_data(self):
        """Refresh only list containers — inputs and scroll untouched."""
        self._fill_summary()
        self._fill_prayer_list()
        self._fill_bible_list()
        self._fill_meditation_list()
        self._fill_event_list()
        self._fill_note_list()

    def _build(self):
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(top_nav(self, "✦  SPIRIT", GOLD))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # Summary row — dynamic
        self._summary_container = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(72)
        )
        self._fill_summary()
        body.add_widget(self._summary_container)

        # ── Prayer ────────────────────────────────────────────────
        body.add_widget(self._section("✦  PRAYER"))
        body.add_widget(self._build_prayer_inputs())
        self._prayer_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None
        )
        self._prayer_list.bind(
            minimum_height=self._prayer_list.setter("height"))
        self._fill_prayer_list()
        body.add_widget(self._prayer_list)

        # ── Bible ─────────────────────────────────────────────────
        body.add_widget(self._section("📖  BIBLE READING"))
        body.add_widget(self._build_bible_inputs())
        self._bible_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None
        )
        self._bible_list.bind(
            minimum_height=self._bible_list.setter("height"))
        self._fill_bible_list()
        body.add_widget(self._bible_list)

        # ── Meditation ────────────────────────────────────────────
        body.add_widget(self._section("🧘  MEDITATION"))
        body.add_widget(self._build_meditation_inputs())
        self._meditation_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None
        )
        self._meditation_list.bind(
            minimum_height=self._meditation_list.setter("height"))
        self._fill_meditation_list()
        body.add_widget(self._meditation_list)

        # ── Teenagers Department ──────────────────────────────────
        body.add_widget(self._section("⛪  TEENAGERS DEPARTMENT"))
        body.add_widget(self._build_event_inputs())
        self._event_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None
        )
        self._event_list.bind(
            minimum_height=self._event_list.setter("height"))
        self._fill_event_list()
        body.add_widget(self._event_list)

        # ── Meeting Notes ─────────────────────────────────────────
        body.add_widget(self._section("📝  MEETING NOTES"))
        body.add_widget(self._build_note_inputs())
        self._note_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None
        )
        self._note_list.bind(
            minimum_height=self._note_list.setter("height"))
        self._fill_note_list()
        body.add_widget(self._note_list)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    # ── Fill methods — data only ──────────────────────────────────

    def _fill_summary(self):
        self._summary_container.clear_widgets()
        summary = self.ctrl.get_summary()
        self._summary_container.add_widget(
            self._mini_card("PRAYERS\nTODAY",
                            str(summary["prayers_today"]), GOLD))
        self._summary_container.add_widget(
            self._mini_card("BIBLE\nTODAY",
                            str(summary["bible_today"]), GREEN))
        self._summary_container.add_widget(
            self._mini_card("UPCOMING\nEVENTS",
                            str(len(summary["upcoming_events"])), PURPLE))

    def _fill_prayer_list(self):
        self._prayer_list.clear_widgets()
        for p in self.ctrl.get_recent_prayers(5):
            self._prayer_list.add_widget(self._log_row(
                p["type"].upper(),
                p["note"] or "—",
                p["date"], GOLD,
                lambda x, id=p["id"]: self._delete_prayer(id)
            ))

    def _fill_bible_list(self):
        self._bible_list.clear_widgets()
        for b in self.ctrl.get_recent_bible(5):
            self._bible_list.add_widget(self._log_row(
                b["passage"],
                b["note"] or "—",
                b["date"], GREEN,
                lambda x, id=b["id"]: self._delete_bible(id)
            ))

    def _fill_meditation_list(self):
        self._meditation_list.clear_widgets()
        for m in self.ctrl.get_recent_meditations(5):
            self._meditation_list.add_widget(self._log_row(
                f"{m['duration']} mins",
                m["note"] or "—",
                m["date"], PURPLE,
                lambda x, id=m["id"]: self._delete_meditation(id)
            ))

    def _fill_event_list(self):
        self._event_list.clear_widgets()
        for e in self.ctrl.get_upcoming_events():
            self._event_list.add_widget(self._event_row(e))

    def _fill_note_list(self):
        self._note_list.clear_widgets()
        for n in self.ctrl.get_meeting_notes(5):
            self._note_list.add_widget(self._note_row(n))

    # ── Input builders — built once ───────────────────────────────

    def _build_prayer_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            size_hint_y=None, height=dp(100)
        )
        self._prayer_note = MDTextField(
            hint_text="Prayer note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        box.add_widget(self._prayer_note)
        btn_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(8),
            size_hint_y=None, height=dp(40)
        )
        for label, type_ in [
            ("🌅 MORNING", "morning"),
            ("🌙 NIGHT", "night"),
            ("⚡ SPONTANEOUS", "other")
        ]:
            btn = MDRaisedButton(
                text=label,
                md_bg_color=_c(PANEL),
                size_hint_x=1/3,
                font_size="10sp"
            )
            btn.bind(on_release=lambda x, t=type_: self._log_prayer(t))
            btn_row.add_widget(btn)
        box.add_widget(btn_row)
        return box

    def _build_bible_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            size_hint_y=None, height=dp(140)
        )
        self._bible_passage = MDTextField(
            hint_text="Passage (e.g. John 3:16)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._bible_note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        log_btn = MDRaisedButton(
            text="LOG READING",
            md_bg_color=_c(GREEN),
            size_hint_y=None, height=dp(40)
        )
        log_btn.bind(on_release=lambda x: self._log_bible())
        box.add_widget(self._bible_passage)
        box.add_widget(self._bible_note)
        box.add_widget(log_btn)
        return box

    def _build_meditation_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            size_hint_y=None, height=dp(140)
        )
        self._med_duration = MDTextField(
            hint_text="Duration (minutes)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._med_note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        log_btn = MDRaisedButton(
            text="LOG MEDITATION",
            md_bg_color=_c(PURPLE),
            size_hint_y=None, height=dp(40)
        )
        log_btn.bind(on_release=lambda x: self._log_meditation())
        box.add_widget(self._med_duration)
        box.add_widget(self._med_note)
        box.add_widget(log_btn)
        return box

    def _build_event_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            size_hint_y=None, height=dp(188)
        )
        self._event_title = MDTextField(
            hint_text="Event title",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._event_date = MDTextField(
            hint_text="Date (YYYY-MM-DD)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._event_notes = MDTextField(
            hint_text="Notes (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        add_btn = MDRaisedButton(
            text="ADD EVENT",
            md_bg_color=_c(GOLD),
            size_hint_y=None, height=dp(40)
        )
        add_btn.bind(on_release=lambda x: self._add_event())
        box.add_widget(self._event_title)
        box.add_widget(self._event_date)
        box.add_widget(self._event_notes)
        box.add_widget(add_btn)
        return box

    def _build_note_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            size_hint_y=None, height=dp(188)
        )
        self._note_title = MDTextField(
            hint_text="Note title",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._note_content = MDTextField(
            hint_text="Meeting notes...",
            mode="rectangle",
            multiline=True,
            size_hint_y=None, height=dp(100)
        )
        add_btn = MDRaisedButton(
            text="SAVE NOTE",
            md_bg_color=_c(ACCENT),
            size_hint_y=None, height=dp(40)
        )
        add_btn.bind(on_release=lambda x: self._add_note())
        box.add_widget(self._note_title)
        box.add_widget(self._note_content)
        box.add_widget(add_btn)
        return box

    # ── Actions ───────────────────────────────────────────────────

    def _log_prayer(self, type_):
        ok, _ = self.ctrl.log_prayer(
            type_, self._prayer_note.text.strip())
        if ok:
            self._prayer_note.text = ""
            self._update_data()

    def _log_bible(self):
        ok, _ = self.ctrl.log_bible(
            self._bible_passage.text,
            self._bible_note.text)
        if ok:
            self._bible_passage.text = ""
            self._bible_note.text = ""
            self._update_data()

    def _log_meditation(self):
        ok, _ = self.ctrl.log_meditation(
            self._med_duration.text,
            self._med_note.text)
        if ok:
            self._med_duration.text = ""
            self._med_note.text = ""
            self._update_data()

    def _add_event(self):
        ok, _ = self.ctrl.add_event(
            self._event_title.text,
            self._event_date.text,
            notes=self._event_notes.text)
        if ok:
            self._event_title.text = ""
            self._event_date.text = ""
            self._event_notes.text = ""
            self._update_data()

    def _add_note(self):
        ok, _ = self.ctrl.add_meeting_note(
            self._note_title.text,
            self._note_content.text)
        if ok:
            self._note_title.text = ""
            self._note_content.text = ""
            self._update_data()

    def _delete_prayer(self, id_):
        self.ctrl.delete_prayer(id_)
        self._update_data()

    def _delete_bible(self, id_):
        self.ctrl.delete_bible_log(id_)
        self._update_data()

    def _delete_meditation(self, id_):
        self.ctrl.delete_meditation(id_)
        self._update_data()

    def _delete_event(self, id_):
        self.ctrl.delete_event(id_)
        self._update_data()

    def _delete_note(self, id_):
        self.ctrl.delete_meeting_note(id_)
        self._update_data()

    # ── Reusable widgets ──────────────────────────────────────────

    def _mini_card(self, label, value, color):
        card = MDCard(
            orientation="vertical",
            radius=[8], elevation=0,
            padding=dp(10),
            size_hint_x=1/3,
            md_bg_color=_c(PANEL)
        )
        card.add_widget(MDLabel(
            text=label,
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            halign="center"
        ))
        card.add_widget(MDLabel(
            text=value,
            font_style="H5",
            theme_text_color="Custom",
            text_color=_c(color),
            halign="center",
            bold=True
        ))
        return card

    def _log_row(self, title, subtitle, date, color, on_delete):
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(56),
            md_bg_color=_c(PANEL),
            spacing=dp(8)
        )
        info = MDBoxLayout(
            orientation="vertical", size_hint_x=0.75)
        info.add_widget(MDLabel(
            text=title,
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(color),
            size_hint_y=0.55
        ))
        info.add_widget(MDLabel(
            text=f"{subtitle}  ·  {date}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=0.45
        ))
        row.add_widget(info)
        del_btn = MDFlatButton(
            text="✕",
            theme_text_color="Custom",
            text_color=_c(RED),
            size_hint_x=0.25
        )
        del_btn.bind(on_release=on_delete)
        row.add_widget(del_btn)
        return row

    def _event_row(self, e):
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(56),
            md_bg_color=_c(PANEL),
            spacing=dp(8)
        )
        info = MDBoxLayout(
            orientation="vertical", size_hint_x=0.75)
        info.add_widget(MDLabel(
            text=e["title"],
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(GOLD),
            size_hint_y=0.55
        ))
        info.add_widget(MDLabel(
            text=e["event_date"],
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=0.45
        ))
        row.add_widget(info)
        del_btn = MDFlatButton(
            text="✕",
            theme_text_color="Custom",
            text_color=_c(RED),
            size_hint_x=0.25
        )
        del_btn.bind(
            on_release=lambda x, id=e["id"]: self._delete_event(id))
        row.add_widget(del_btn)
        return row

    def _note_row(self, n):
        row = MDCard(
            orientation="vertical",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(80),
            md_bg_color=_c(PANEL),
            spacing=dp(4)
        )
        top = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(28)
        )
        top.add_widget(MDLabel(
            text=n["title"],
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(ACCENT),
            size_hint_x=0.75
        ))
        del_btn = MDFlatButton(
            text="✕",
            theme_text_color="Custom",
            text_color=_c(RED),
            size_hint_x=0.25
        )
        del_btn.bind(
            on_release=lambda x, id=n["id"]: self._delete_note(id))
        top.add_widget(del_btn)
        row.add_widget(top)
        row.add_widget(MDLabel(
            text=n["content"][:80] + (
                "..." if len(n["content"]) > 80 else ""),
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(28)
        ))
        row.add_widget(MDLabel(
            text=n["date"],
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(18)
        ))
        return row

    def _section(self, text):
        return MDLabel(
            text=text,
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None,
            height=dp(32)
        )


