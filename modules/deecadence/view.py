from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.slider import MDSlider
from kivymd.uix.progressbar import MDProgressBar
from kivy.uix.widget import Widget
from kivy.uix.boxlayout import BoxLayout
from kivy.graphics import Color, RoundedRectangle, Line
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from modules.deecadence.controller import (
    DeeCadenceController, DISTRACTION_TYPES,
    DIFFICULTY_LABELS, calculate_blocks
)
from shared.theme import c, t, hex_color, R
from shared.components import (
    spacer, section_label, input_field,
    log_row, empty_state, summary_card
)

DC_ACCENT  = t("deecadence")
DC_RED     = t("error")
DC_GREEN   = t("success")
DC_GOLD    = t("spirit")
DC_DIM     = t("text3")
DC_CARD    = t("card")


def _c(h): return hex_color(h)


class DeeCadenceScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._built = False
        self._current_view = "home"
        self._refresh_event = None

        # Session state
        self._active_session_id = None
        self._active_blocks = None
        self._current_block = 0
        self._energy_scores = []
        self._session_clock = None
        self._session_timer = 0
        self._phase = "focus"

        # Input refs
        self._distraction_hours = 1.0
        self._distraction_type = DISTRACTION_TYPES[0]
        self._distraction_type_btn = None
        self._distraction_menu = None
        self._task_name = None
        self._task_mins = None
        self._task_difficulty = 3
        self._diff_row = None
        self._diff_label = None
        self._block_preview = None
        self._slider_label = None
        self._debt_preview = None

        # Dynamic containers
        self._content = None
        self._nav_container = None

    def on_enter(self):
        self.md_bg_color = c("bg")
        if not self._built:
            app = App.get_running_app()
            self.ctrl = DeeCadenceController(app.db)
            self._build_shell()
            self._built = True
        self._show_view("home")
        self._refresh_event = Clock.schedule_interval(
            lambda dt: self._refresh_home_if_visible(), 10)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None
        if self._session_clock:
            self._session_clock.cancel()

    def _refresh_home_if_visible(self):
        if self._current_view == "home":
            self._show_view("home")

    def _build_shell(self):
        root = MDBoxLayout(orientation="vertical")

        # Dynamic nav bar — changes per view
        self._nav_container = MDBoxLayout(
            orientation="vertical",
            size_hint_y=None, height=dp(56))
        root.add_widget(self._nav_container)

        self._content = MDBoxLayout(orientation="vertical")
        root.add_widget(self._content)
        self.add_widget(root)

    def _update_nav(self, title, back_fn):
        """Single nav bar, single back button. No duplicates."""
        self._nav_container.clear_widgets()
        nav = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(56),
            padding=[dp(4), 0, dp(16), 0],
            md_bg_color=c("bg2"))
        back = MDFlatButton(
            text="< Back",
            font_size="13sp",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_x=None, width=dp(80))
        back.bind(on_release=lambda x: back_fn())
        nav.add_widget(back)
        nav.add_widget(MDLabel(
            text=title, font_style="H6",
            theme_text_color="Custom",
            text_color=_c(t("deecadence")),
            bold=True, valign="center"))
        self._nav_container.add_widget(nav)

    def _show_view(self, view):
        self._current_view = view
        self._content.clear_widgets()

        # Update nav based on current view
        nav_map = {
            "home":         ("DeeCadence",
                             lambda: setattr(self.manager, "current", "mind")),
            "distraction":  ("Log Distraction",
                             lambda: self._show_view("home")),
            "session_setup":("New Session",
                             lambda: self._show_view("home")),
            "session_active":("Focus Session",
                              lambda: self._abandon_session()),
            "energy_prompt":("Energy Check",
                             lambda: None),
            "stats":        ("Analytics",
                             lambda: self._show_view("home")),
        }
        title, back_fn = nav_map.get(
            view, ("DeeCadence", lambda: self._show_view("home")))
        self._update_nav(title, back_fn)

        if view == "home":
            self._content.add_widget(self._build_home())
        elif view == "distraction":
            self._content.add_widget(self._build_distraction())
        elif view == "session_setup":
            self._content.add_widget(self._build_session_setup())
        elif view == "session_active":
            self._content.add_widget(self._build_session_active())
        elif view == "energy_prompt":
            self._content.add_widget(self._build_energy_prompt())
        elif view == "stats":
            self._content.add_widget(self._build_stats())

    # ── HOME ──────────────────────────────────────────────────────

    def _build_home(self):
        summary = self.ctrl.get_summary()
        score = summary["attention_score"]
        debt_str = summary["focus_debt"]
        debt_mins = summary["focus_debt_mins"]
        has_active = summary["has_active"]

        root = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=[dp(16), dp(16), dp(16), dp(24)],
            size_hint_y=None)
        body.bind(minimum_height=body.setter("height"))

        # Attention score card
        score_card = MDCard(
            orientation="horizontal",
            radius=R["lg"], elevation=0,
            padding=[dp(16), dp(14)],
            size_hint_y=None, height=dp(88),
            md_bg_color=c("card"), spacing=dp(16))

        score_col = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.3)
        score_col.add_widget(MDLabel(
            text="ATTENTION", font_style="Overline",
            theme_text_color="Custom",
            text_color=c("text3"), size_hint_y=0.4))
        score_color = (
            "success" if score >= 80
            else "warning" if score >= 50
            else "error")
        score_col.add_widget(MDLabel(
            text=f"{score}",
            font_style="H4",
            theme_text_color="Custom",
            text_color=_c(t(score_color)),
            bold=True, size_hint_y=0.6))
        score_card.add_widget(score_col)

        # Debt info
        debt_col = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.7)
        debt_col.add_widget(MDLabel(
            text="FOCUS DEBT",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(20)))

        if debt_mins > 0:
            hook = (
                f"{debt_str} handed to distraction."
                if debt_mins >= 60
                else f"{debt_str} of drift. Reclaim it.")
            debt_col.add_widget(MDLabel(
                text=hook, font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(t("error")),
                size_hint_y=None, height=dp(40)))
        else:
            debt_col.add_widget(MDLabel(
                text="No debt. You are clear.",
                font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(t("success")),
                size_hint_y=None, height=dp(40)))
        score_card.add_widget(debt_col)
        body.add_widget(score_card)

        # Action buttons
        if has_active:
            resume = MDRaisedButton(
                text="Resume Session",
                md_bg_color=_c(t("deecadence")),
                size_hint_y=None, height=dp(52))
            resume.bind(
                on_release=lambda x: self._resume_active())
            body.add_widget(resume)
        else:
            btn_row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(10),
                size_hint_y=None, height=dp(52))
            focus_btn = MDRaisedButton(
                text="Start Session",
                md_bg_color=_c(t("deecadence")),
                size_hint_x=0.5)
            focus_btn.bind(
                on_release=lambda x:
                    self._show_view("session_setup"))
            log_btn = MDRaisedButton(
                text="Log Distraction",
                md_bg_color=_c(t("error")),
                size_hint_x=0.5)
            log_btn.bind(
                on_release=lambda x:
                    self._show_view("distraction"))
            btn_row.add_widget(focus_btn)
            btn_row.add_widget(log_btn)
            body.add_widget(btn_row)

        stats_btn = MDFlatButton(
            text="View Analytics >",
            theme_text_color="Custom",
            text_color=_c(t("deecadence")),
            size_hint_y=None, height=dp(40))
        stats_btn.bind(
            on_release=lambda x: self._show_view("stats"))
        body.add_widget(stats_btn)

        # Recent sessions
        sessions = self.ctrl.get_recent_sessions(3)
        if sessions:
            body.add_widget(
                section_label("RECENT", top_space=False))
            for s in sessions:
                color = "success" if s["completed"] else "warning"
                body.add_widget(log_row(
                    s["task_name"],
                    f"D{s['difficulty']} · "
                    f"{s['blocks_done']}/4 blocks · "
                    f"{s['date']}",
                    color))

        root.add_widget(body)
        return root

    # ── DISTRACTION ───────────────────────────────────────────────

    def _build_distraction(self):
        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(16), spacing=dp(14))

        root.add_widget(MDLabel(
            text="How many hours did you lose?",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=c("text"),
            size_hint_y=None, height=dp(28)))

        self._slider_label = MDLabel(
            text=f"{self._distraction_hours:.1f} hrs  "
                 f"= {int(self._distraction_hours*60)} mins lost",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(t("error")), bold=True,
            size_hint_y=None, height=dp(28),
            halign="center")
        root.add_widget(self._slider_label)

        slider = MDSlider(
            min=0.25, max=12,
            value=self._distraction_hours,
            step=0.25,
            size_hint_y=None, height=dp(44))
        slider.bind(value=self._on_slider_change)
        root.add_widget(slider)

        self._debt_preview = MDLabel(
            text=self._debt_text(),
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(t("error")),
            size_hint_y=None, height=dp(36),
            halign="center")
        root.add_widget(self._debt_preview)

        root.add_widget(MDLabel(
            text="What stole your focus?",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None, height=dp(24)))

        self._distraction_type_btn = MDRaisedButton(
            text=self._distraction_type,
            md_bg_color=c("card"),
            size_hint_y=None, height=dp(48))
        menu_items = [
            {"text": t_, "viewclass": "OneLineListItem",
             "on_release": lambda x=t_:
                 self._set_distraction_type(x)}
            for t_ in DISTRACTION_TYPES
        ]
        self._distraction_menu = MDDropdownMenu(
            caller=self._distraction_type_btn,
            items=menu_items, width_mult=4)
        self._distraction_type_btn.bind(
            on_release=lambda x:
                self._distraction_menu.open())
        root.add_widget(self._distraction_type_btn)

        # Emotional hook card
        hook_card = MDCard(
            orientation="vertical",
            radius=R["md"], elevation=0,
            padding=[dp(16), dp(12)],
            size_hint_y=None, height=dp(64),
            md_bg_color=_c(t("error") + "15"))
        hook_card.add_widget(MDLabel(
            text="Every minute you log is a minute you own.\n"
                 "Awareness is the first payment.",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(t("spirit")),
            halign="center"))
        root.add_widget(hook_card)

        log_btn = MDRaisedButton(
            text="LOG DISTRACTION",
            md_bg_color=_c(t("error")),
            size_hint_y=None, height=dp(52))
        log_btn.bind(
            on_release=lambda x: self._log_distraction())
        root.add_widget(log_btn)
        return root

    def _debt_text(self):
        mins = int(self._distraction_hours * 60)
        if mins >= 60:
            return f"Focus Debt: {mins/60:.1f} hours"
        return f"Focus Debt: {mins} minutes"

    def _on_slider_change(self, slider, value):
        self._distraction_hours = round(value, 2)
        try:
            mins = int(self._distraction_hours * 60)
            self._slider_label.text = (
                f"{self._distraction_hours:.1f} hrs  "
                f"= {mins} mins lost")
            self._debt_preview.text = self._debt_text()
        except Exception:
            pass

    def _set_distraction_type(self, type_):
        self._distraction_type = type_
        self._distraction_type_btn.text = type_
        self._distraction_menu.dismiss()

    def _log_distraction(self):
        ok, _ = self.ctrl.log_distraction(
            self._distraction_hours,
            self._distraction_type)
        if ok:
            self._show_view("home")

    # ── SESSION SETUP ─────────────────────────────────────────────

    def _build_session_setup(self):
        root = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=dp(16), spacing=dp(12),
            size_hint_y=None)
        body.bind(minimum_height=body.setter("height"))

        self._task_name = input_field(
            "What are you working on?")
        body.add_widget(self._task_name)

        self._task_mins = input_field(
            "Duration (minutes, min 4)",
            input_filter="int")
        body.add_widget(self._task_mins)

        body.add_widget(MDLabel(
            text="Difficulty:",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text"),
            size_hint_y=None, height=dp(24)))

        self._diff_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(8),
            size_hint_y=None, height=dp(48))
        for d in range(1, 6):
            btn = MDRaisedButton(
                text=str(d),
                md_bg_color=_c(
                    t("deecadence")
                    if d == self._task_difficulty
                    else t("card")),
                size_hint_x=0.2)
            btn.bind(
                on_release=lambda x, dv=d:
                    self._set_difficulty(dv))
            self._diff_row.add_widget(btn)
        body.add_widget(self._diff_row)

        self._diff_label = MDLabel(
            text=DIFFICULTY_LABELS[self._task_difficulty],
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(20))
        body.add_widget(self._diff_label)

        self._block_preview = MDLabel(
            text="Enter duration to see block breakdown",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(36))
        body.add_widget(self._block_preview)
        self._task_mins.bind(
            text=lambda i, v:
                self._update_block_preview(v))

        start_btn = MDRaisedButton(
            text="BEGIN SESSION",
            md_bg_color=_c(t("deecadence")),
            size_hint_y=None, height=dp(52))
        start_btn.bind(
            on_release=lambda x: self._start_session())
        body.add_widget(start_btn)

        root.add_widget(body)
        return root

    def _set_difficulty(self, val):
        self._task_difficulty = val
        try:
            self._diff_label.text = DIFFICULTY_LABELS[val]
            for i, btn in enumerate(
                    self._diff_row.children[::-1]):
                btn.md_bg_color = _c(
                    t("deecadence")
                    if i+1 == val else t("card"))
        except Exception:
            pass

    def _update_block_preview(self, val):
        try:
            mins = int(val)
            if mins >= 4:
                b = calculate_blocks(
                    mins, self._task_difficulty)
                self._block_preview.text = (
                    f"4 blocks x {b['focus_mins']}min  "
                    f"· {b['short_break']}min break  "
                    f"· {b['long_break']}min long break")
        except Exception:
            self._block_preview.text = (
                "Enter duration to see breakdown")

    def _start_session(self):
        session_id, result = self.ctrl.start_session(
            self._task_name.text,
            self._task_mins.text,
            self._task_difficulty)
        if session_id is None:
            return
        self._active_session_id = session_id
        self._active_blocks = result
        self._current_block = 0
        self._energy_scores = []
        self._phase = "focus"
        self._show_view("session_active")
        self._start_block_timer()

    def _resume_active(self):
        session = self.ctrl.get_active_session()
        if not session:
            self._show_view("home")
            return
        self._active_session_id = session["id"]
        self._active_blocks = session["blocks"]
        self._current_block = session["blocks_done"]
        self._energy_scores = session["energy_scores"]
        self._phase = "focus"
        self._show_view("session_active")
        self._start_block_timer()

    # ── SESSION ACTIVE ────────────────────────────────────────────

    def _build_session_active(self):
        if not self._active_blocks:
            self._show_view("home")
            return MDBoxLayout()

        b = self._active_blocks
        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(20), spacing=dp(16))

        session = self.ctrl.get_active_session()
        task = session["task_name"] if session else "Focus"

        root.add_widget(MDLabel(
            text=task, font_style="H5",
            theme_text_color="Custom",
            text_color=_c(t("deecadence")),
            bold=True,
            size_hint_y=None, height=dp(44),
            halign="center"))

        # Block dots
        dots = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(24),
            spacing=dp(8))
        for i in range(4):
            color = (
                "deecadence" if i == self._current_block
                else "success" if i < self._current_block
                else "text4")
            dots.add_widget(MDLabel(
                text="●", font_style="H6",
                theme_text_color="Custom",
                text_color=_c(t(color)),
                halign="center"))
        root.add_widget(dots)

        phase_text = (
            "FOCUS" if self._phase == "focus"
            else "SHORT BREAK"
            if self._phase == "short_break"
            else "LONG BREAK")
        phase_color = (
            "deecadence" if self._phase == "focus"
            else "success")
        self._phase_label = MDLabel(
            text=phase_text, font_style="H6",
            theme_text_color="Custom",
            text_color=_c(t(phase_color)),
            size_hint_y=None, height=dp(36),
            halign="center")
        root.add_widget(self._phase_label)

        self._timer_label = MDLabel(
            text=self._fmt_time(self._session_timer),
            font_style="H2",
            theme_text_color="Custom",
            text_color=_c(t("deecadence")),
            size_hint_y=None, height=dp(80),
            halign="center")
        root.add_widget(self._timer_label)

        self._session_progress = MDProgressBar(
            value=0, color=_c(t("deecadence")),
            size_hint_y=None, height=dp(6))
        root.add_widget(self._session_progress)

        abandon = MDFlatButton(
            text="Abandon session",
            theme_text_color="Custom",
            text_color=_c(t("error")),
            size_hint_y=None, height=dp(36))
        abandon.bind(
            on_release=lambda x: self._abandon_session())
        root.add_widget(abandon)
        return root

    def _start_block_timer(self):
        if self._session_clock:
            self._session_clock.cancel()
        b = self._active_blocks
        if self._phase == "focus":
            self._session_timer = b["focus_mins"] * 60
        elif self._phase == "short_break":
            self._session_timer = b["short_break"] * 60
        else:
            self._session_timer = b["long_break"] * 60
        self._session_clock = Clock.schedule_interval(
            self._session_tick, 1)

    def _session_tick(self, dt):
        self._session_timer -= 1
        b = self._active_blocks
        try:
            self._timer_label.text = self._fmt_time(
                self._session_timer)
            total = (
                b["focus_mins"]*60
                if self._phase == "focus"
                else b["short_break"]*60
                if self._phase == "short_break"
                else b["long_break"]*60)
            elapsed = total - self._session_timer
            pct = min(100, (elapsed/max(1,total))*100)
            self._session_progress.value = pct
        except Exception:
            pass
        if self._session_timer <= 0:
            self._session_clock.cancel()
            self._on_phase_complete()

    def _on_phase_complete(self):
        if self._phase == "focus":
            self._show_view("energy_prompt")
        else:
            self._phase = "focus"
            self._show_view("session_active")
            self._start_block_timer()

    def _on_energy_recorded(self, score):
        self._energy_scores.append(score)
        self._current_block += 1
        self.ctrl.complete_block(
            self._active_session_id,
            self._current_block,
            self._energy_scores)
        if self._current_block >= 4:
            self.ctrl.complete_session(
                self._active_session_id,
                self._current_block,
                self._energy_scores)
            self._show_view("home")
        else:
            self._phase = "short_break"
            self._show_view("session_active")
            self._start_block_timer()

    def _abandon_session(self):
        if self._active_session_id:
            self.ctrl.abandon_session(
                self._active_session_id)
        if self._session_clock:
            self._session_clock.cancel()
        self._active_session_id = None
        self._active_blocks = None
        self._current_block = 0
        self._energy_scores = []
        self._phase = "focus"
        self._show_view("home")

    # ── ENERGY PROMPT ─────────────────────────────────────────────

    def _build_energy_prompt(self):
        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(24), spacing=dp(16))

        root.add_widget(MDLabel(
            text=f"Block {self._current_block+1} Complete",
            font_style="H5",
            theme_text_color="Custom",
            text_color=_c(t("success")), bold=True,
            size_hint_y=None, height=dp(44),
            halign="center"))

        root.add_widget(MDLabel(
            text="How is your energy right now?",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=c("text"),
            size_hint_y=None, height=dp(32),
            halign="center"))

        energy_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(8),
            size_hint_y=None, height=dp(56))
        for i, emoji in enumerate(
                ["Low", "OK", "Good", "Great", "Peak"]):
            score = i + 1
            btn = MDRaisedButton(
                text=emoji,
                md_bg_color=c("card"),
                size_hint_x=0.2,
                font_size="11sp")
            btn.bind(
                on_release=lambda x, s=score:
                    self._on_energy_recorded(s))
            energy_row.add_widget(btn)
        root.add_widget(energy_row)
        return root

    # ── STATS VIEW ────────────────────────────────────────────────

    def _build_stats(self):
        root = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(14),
            padding=[dp(16), dp(16), dp(16), dp(24)],
            size_hint_y=None)
        body.bind(minimum_height=body.setter("height"))

        score = self.ctrl.get_attention_score()
        debt_str, _ = self.ctrl.get_focus_debt()

        body.add_widget(
            section_label("ATTENTION SCORE",
                          top_space=False))
        score_color = (
            "success" if score >= 80
            else "warning" if score >= 50
            else "error")
        body.add_widget(MDLabel(
            text=f"{score} / 100",
            font_style="H3",
            theme_text_color="Custom",
            text_color=_c(t(score_color)),
            halign="center",
            size_hint_y=None, height=dp(56)))

        body.add_widget(section_label("FOCUS DEBT"))
        body.add_widget(MDLabel(
            text=debt_str,
            font_style="H5",
            theme_text_color="Custom",
            text_color=_c(t("error")),
            halign="center",
            size_hint_y=None, height=dp(44)))

        sessions = self.ctrl.get_recent_sessions(7)
        if sessions:
            body.add_widget(
                section_label("SESSION HISTORY"))
            for s in sessions:
                color = (
                    "success" if s["completed"]
                    else "warning")
                avg_e = (
                    sum(s["energy_scores"]) /
                    len(s["energy_scores"])
                    if s["energy_scores"] else 0)
                body.add_widget(log_row(
                    s["task_name"],
                    f"D{s['difficulty']} · "
                    f"{s['blocks_done']}/4 · "
                    f"E{avg_e:.1f} · {s['date']}",
                    color))

        root.add_widget(body)
        return root

    def _fmt_time(self, seconds):
        s = max(0, int(seconds))
        return f"{s//60:02d}:{s%60:02d}"
    