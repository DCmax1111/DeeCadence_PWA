from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivymd.uix.selectioncontrol import MDCheckbox
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from modules.energy.controller import (
    EnergyController, HYGIENE_ITEMS)
from shared.theme import c, t, hex_color, R
from shared.components import (
    top_nav, section_label, log_row,
    empty_state, spacer, summary_card,
    input_field, primary_btn
)

def _c(h): return hex_color(h)


class EnergyScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._built = False
        self._refresh_event = None
        self._hygiene_selected = set()
        self._summary_container = None
        self._sleep_list = None
        self._exercise_list = None
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
        self.md_bg_color = c("bg")
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
        root.add_widget(
            top_nav(self, "Energy", "energy"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            padding=[dp(16), dp(14), dp(16), dp(24)],
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
        body.add_widget(spacer(8))

        # Sleep
        body.add_widget(
            section_label("SLEEP", top_space=False))
        self._sleep_hours = input_field(
            "Hours slept (e.g. 7.5)",
            input_filter="float")
        self._sleep_quality = input_field(
            "Quality 1-5  (5 = best)",
            input_filter="int")
        self._sleep_note = input_field(
            "Note (optional)")
        log_sleep_btn = MDRaisedButton(
            text="LOG SLEEP",
            md_bg_color=_c(t("energy")),
            size_hint_y=None, height=dp(52)
        )
        log_sleep_btn.bind(
            on_release=lambda x: self._log_sleep())
        body.add_widget(self._sleep_hours)
        body.add_widget(self._sleep_quality)
        body.add_widget(self._sleep_note)
        body.add_widget(log_sleep_btn)
        body.add_widget(spacer(6))

        self._sleep_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._sleep_list.bind(
            minimum_height=self._sleep_list
            .setter("height"))
        self._fill_sleep_list()
        body.add_widget(self._sleep_list)

        # Hydration
        body.add_widget(section_label("HYDRATION"))
        h_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(52)
        )
        self._hydration_glasses = input_field(
            "Glasses of water",
            input_filter="int")
        h_log_btn = MDRaisedButton(
            text="+ LOG",
            md_bg_color=_c(t("energy")),
            size_hint_x=None, width=dp(90),
            height=dp(52)
        )
        h_log_btn.bind(
            on_release=lambda x: self._log_hydration())
        h_row.add_widget(self._hydration_glasses)
        h_row.add_widget(h_log_btn)
        body.add_widget(h_row)
        body.add_widget(spacer(8))

        # Exercise
        body.add_widget(section_label("EXERCISE"))
        self._exercise_type_btn = MDRaisedButton(
            text=f"Type: {self._selected_exercise_type}",
            md_bg_color=c("card"),
            size_hint_y=None, height=dp(52)
        )
        menu_items = [
            {
                "text": et,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=et:
                    self._set_exercise_type(x)
            }
            for et in EXERCISE_TYPES
        ]
        self._exercise_menu = MDDropdownMenu(
            caller=self._exercise_type_btn,
            items=menu_items,
            width_mult=4
        )
        self._exercise_type_btn.bind(
            on_release=lambda x:
                self._exercise_menu.open())
        body.add_widget(self._exercise_type_btn)

        self._exercise_duration = input_field(
            "Duration (minutes)",
            input_filter="int")
        self._exercise_intensity = input_field(
            "Intensity 1-5",
            input_filter="int")
        self._exercise_note = input_field(
            "Note (optional)")
        ex_btn = MDRaisedButton(
            text="LOG EXERCISE",
            md_bg_color=_c(t("energy")),
            size_hint_y=None, height=dp(52)
        )
        ex_btn.bind(
            on_release=lambda x: self._log_exercise())
        body.add_widget(self._exercise_duration)
        body.add_widget(self._exercise_intensity)
        body.add_widget(self._exercise_note)
        body.add_widget(ex_btn)
        body.add_widget(spacer(6))

        self._exercise_list = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._exercise_list.bind(
            minimum_height=self._exercise_list
            .setter("height"))
        self._fill_exercise_list()
        body.add_widget(self._exercise_list)

        # Hygiene
        body.add_widget(section_label("HYGIENE"))
        for item in HYGIENE_ITEMS:
            row = MDBoxLayout(
                orientation="horizontal",
                size_hint_y=None, height=dp(44))
            cb = MDCheckbox(
                size_hint_x=None, width=dp(44),
                active=item in self._hygiene_selected)
            cb.bind(active=lambda x, v, i=item:
                    self._hygiene_selected.add(i)
                    if v else
                    self._hygiene_selected.discard(i))
            row.add_widget(cb)
            row.add_widget(MDLabel(
                text=item,
                font_style="Body2",
                theme_text_color="Custom",
                text_color=c("text")
            ))
            body.add_widget(row)

        hyg_btn = MDRaisedButton(
            text="LOG HYGIENE",
            md_bg_color=_c(t("energy")),
            size_hint_y=None, height=dp(52)
        )
        hyg_btn.bind(
            on_release=lambda x: self._log_hygiene())
        body.add_widget(hyg_btn)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _fill_summary(self):
        self._summary_container.clear_widgets()
        s = self.ctrl.get_summary()
        sleep_text = (
            f"{s['sleep']['hours']}hrs"
            if s["sleep"] else "—")
        for label, val, ck in [
            ("SLEEP",   sleep_text,              "energy"),
            ("WATER",   f"{s['hydration']} gl",  "accent"),
            ("HYGIENE", "Done" if s["hygiene"]
                        else "—",                "financial"),
        ]:
            self._summary_container.add_widget(
                summary_card(label, val, ck))

    def _fill_sleep_list(self):
        self._sleep_list.clear_widgets()
        for s in self.ctrl.get_recent_sleep(5):
            self._sleep_list.add_widget(log_row(
                f"{s['hours']}hrs  ·  Q{s['quality']}/5",
                f"{s['note'] or '—'}  ·  {s['date']}",
                "energy"
            ))

    def _fill_exercise_list(self):
        self._exercise_list.clear_widgets()
        for e in self.ctrl.get_recent_exercise(5):
            self._exercise_list.add_widget(log_row(
                f"{e['type']}  ·  {e['duration']}mins  "
                f"·  I{e['intensity']}/5",
                f"{e['note'] or '—'}  ·  {e['date']}",
                "energy"
            ))

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

