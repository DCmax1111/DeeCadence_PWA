from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.card import MDCard
from kivymd.uix.selectioncontrol import MDCheckbox
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from modules.energy.controller import EnergyController, HYGIENE_ITEMS
from shared.theme import (
    ACCENT, GREEN, RED, GOLD,
    PANEL, TEXT, TEXT_DIM, hex_color
)
from shared.components import top_nav

ORANGE = "#ff8c00"

def _c(h): return hex_color(h)

class EnergyScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self._built = False
        self._refresh_event = None
        self._hygiene_selected = set()

        # Dynamic containers
        self._summary_container = None
        self._sleep_list = None
        self._exercise_list = None

        # Input refs
        self._sleep_hours = None
        self._sleep_quality = None
        self._sleep_note = None
        self._hydration_glasses = None
        self._exercise_type_btn = None
        self._exercise_duration = None
        self._exercise_intensity = None
        self._exercise_note = None
        self._selected_exercise_type = "Running"
        self._exercise_menu = None

    def on_enter(self):
        if not self._built:
            app = App.get_running_app()
            self.ctrl = EnergyController(app.db)
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
        self._fill_summary()
        self._fill_sleep_list()
        self._fill_exercise_list()

    def _build(self):
        from kivymd.uix.menu import MDDropdownMenu
        from modules.energy.controller import EXERCISE_TYPES

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(top_nav(self, "⚡  ENERGY", GREEN))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # Summary
        self._summary_container = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(80)
        )
        self._fill_summary()
        body.add_widget(self._summary_container)

        # ── Sleep ─────────────────────────────────────────────────
        body.add_widget(self._section("😴  SLEEP"))
        body.add_widget(self._build_sleep_inputs())
        self._sleep_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._sleep_list.bind(
            minimum_height=self._sleep_list.setter("height"))
        self._fill_sleep_list()
        body.add_widget(self._sleep_list)

        # ── Hydration ─────────────────────────────────────────────
        body.add_widget(self._section("💧  HYDRATION"))
        body.add_widget(self._build_hydration_inputs())

        # ── Exercise ──────────────────────────────────────────────
        body.add_widget(self._section("🏋  EXERCISE"))

        self._exercise_type_btn = MDRaisedButton(
            text=f"Type: {self._selected_exercise_type}",
            md_bg_color=_c(PANEL),
            size_hint_y=None, height=dp(44)
        )
        menu_items = [
            {
                "text": t,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=t: self._set_exercise_type(x)
            }
            for t in EXERCISE_TYPES
        ]
        self._exercise_menu = MDDropdownMenu(
            caller=self._exercise_type_btn,
            items=menu_items,
            width_mult=4
        )
        self._exercise_type_btn.bind(
            on_release=lambda x: self._exercise_menu.open())
        body.add_widget(self._exercise_type_btn)
        body.add_widget(self._build_exercise_inputs())

        self._exercise_list = MDBoxLayout(
            orientation="vertical", spacing=dp(6),
            size_hint_y=None)
        self._exercise_list.bind(
            minimum_height=self._exercise_list.setter("height"))
        self._fill_exercise_list()
        body.add_widget(self._exercise_list)

        # ── Hygiene ───────────────────────────────────────────────
        body.add_widget(self._section("🧼  HYGIENE"))
        body.add_widget(self._build_hygiene_inputs())

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    # ── Fill methods ──────────────────────────────────────────────

    def _fill_summary(self):
        self._summary_container.clear_widgets()
        s = self.ctrl.get_summary()

        sleep_text = (f"{s['sleep']['hours']}hrs"
                      if s["sleep"] else "—")
        hydration_text = f"{s['hydration']} glasses"
        hygiene_text = ("✓" if s["hygiene"] else "—")

        for label, val, color in [
            ("SLEEP", sleep_text, ACCENT),
            ("WATER TODAY", hydration_text, "#4a9eff"),
            ("HYGIENE", hygiene_text, GREEN),
        ]:
            self._summary_container.add_widget(
                self._mini_card(label, val, color))

    def _fill_sleep_list(self):
        self._sleep_list.clear_widgets()
        for s in self.ctrl.get_recent_sleep(5):
            self._sleep_list.add_widget(self._log_row(
                f"{s['hours']}hrs · Q{s['quality']}/5",
                s["note"] or "—",
                s["date"], ACCENT,
                lambda x, id=s["id"]: self._delete_sleep(id)
            ))

    def _fill_exercise_list(self):
        self._exercise_list.clear_widgets()
        for e in self.ctrl.get_recent_exercise(5):
            self._exercise_list.add_widget(self._log_row(
                f"{e['type']} · {e['duration']}mins · I{e['intensity']}/5",
                e["note"] or "—",
                e["date"], GREEN,
                lambda x, id=e["id"]: self._delete_exercise(id)
            ))

    # ── Input builders ────────────────────────────────────────────

    def _build_sleep_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            size_hint_y=None, height=dp(188)
        )
        self._sleep_hours = MDTextField(
            hint_text="Hours slept (e.g. 7.5)",
            input_filter="float",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._sleep_quality = MDTextField(
            hint_text="Quality 1-5 (5 = best)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._sleep_note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        log_btn = MDRaisedButton(
            text="LOG SLEEP",
            md_bg_color=_c(ACCENT),
            size_hint_y=None, height=dp(40)
        )
        log_btn.bind(on_release=lambda x: self._log_sleep())
        box.add_widget(self._sleep_hours)
        box.add_widget(self._sleep_quality)
        box.add_widget(self._sleep_note)
        box.add_widget(log_btn)
        return box

    def _build_hydration_inputs(self):
        box = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(8),
            size_hint_y=None, height=dp(44)
        )
        self._hydration_glasses = MDTextField(
            hint_text="Glasses of water",
            input_filter="int",
            mode="rectangle",
            size_hint_x=0.7
        )
        log_btn = MDRaisedButton(
            text="+ LOG",
            md_bg_color=_c("#4a9eff"),
            size_hint_x=0.3
        )
        log_btn.bind(on_release=lambda x: self._log_hydration())
        box.add_widget(self._hydration_glasses)
        box.add_widget(log_btn)
        return box

    def _build_exercise_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            size_hint_y=None, height=dp(188)
        )
        self._exercise_duration = MDTextField(
            hint_text="Duration (minutes)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._exercise_intensity = MDTextField(
            hint_text="Intensity 1-5",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        self._exercise_note = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        log_btn = MDRaisedButton(
            text="LOG EXERCISE",
            md_bg_color=_c(GREEN),
            size_hint_y=None, height=dp(40)
        )
        log_btn.bind(on_release=lambda x: self._log_exercise())
        box.add_widget(self._exercise_duration)
        box.add_widget(self._exercise_intensity)
        box.add_widget(self._exercise_note)
        box.add_widget(log_btn)
        return box

    def _build_hygiene_inputs(self):
        box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None,
            height=dp(len(HYGIENE_ITEMS) * 40 + 50)
        )
        for item in HYGIENE_ITEMS:
            row = MDBoxLayout(
                orientation="horizontal",
                size_hint_y=None, height=dp(36)
            )
            cb = MDCheckbox(
                size_hint_x=None, width=dp(40),
                active=item in self._hygiene_selected
            )
            cb.bind(active=lambda x, v, i=item:
                    self._hygiene_selected.add(i) if v
                    else self._hygiene_selected.discard(i))
            row.add_widget(cb)
            row.add_widget(MDLabel(
                text=item,
                font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(TEXT)
            ))
            box.add_widget(row)

        log_btn = MDRaisedButton(
            text="LOG HYGIENE",
            md_bg_color=_c(GREEN),
            size_hint_y=None, height=dp(40)
        )
        log_btn.bind(on_release=lambda x: self._log_hygiene())
        box.add_widget(log_btn)
        return box

    # ── Actions ───────────────────────────────────────────────────

    def _log_sleep(self):
        ok, _ = self.ctrl.log_sleep(
            self._sleep_hours.text,
            self._sleep_quality.text,
            self._sleep_note.text)
        if ok:
            self._sleep_hours.text = ""
            self._sleep_quality.text = ""
            self._sleep_note.text = ""
            self._update_data()

    def _log_hydration(self):
        ok, _ = self.ctrl.log_hydration(
            self._hydration_glasses.text)
        if ok:
            self._hydration_glasses.text = ""
            self._update_data()

    def _log_exercise(self):
        ok, _ = self.ctrl.log_exercise(
            self._selected_exercise_type,
            self._exercise_duration.text,
            self._exercise_intensity.text,
            self._exercise_note.text)
        if ok:
            self._exercise_duration.text = ""
            self._exercise_intensity.text = ""
            self._exercise_note.text = ""
            self._update_data()

    def _log_hygiene(self):
        ok, _ = self.ctrl.log_hygiene(
            list(self._hygiene_selected))
        if ok:
            self._hygiene_selected.clear()
            self._update_data()

    def _set_exercise_type(self, type_):
        self._selected_exercise_type = type_
        self._exercise_type_btn.text = f"Type: {type_}"
        self._exercise_menu.dismiss()

    def _delete_sleep(self, id_):
        self.ctrl.delete_sleep(id_)
        self._update_data()

    def _delete_exercise(self, id_):
        self.ctrl.delete_exercise(id_)
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
            font_style="Body1",
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

    def _section(self, text):
        return MDLabel(
            text=text,
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(32)
        )

