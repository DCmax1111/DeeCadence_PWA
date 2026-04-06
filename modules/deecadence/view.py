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

# ── Debt Graph Widget ─────────────────────────────────────────────

class DebtGraphWidget(Widget):
    """Visual debt repayment graph over 14 days."""

    def __init__(self, history, **kwargs):
        super().__init__(**kwargs)
        self.history = history
        self.bind(size=self._draw, pos=self._draw)

    def _draw(self, *args):
        self.canvas.clear()
        if not self.history:
            return
        w, h = self.width, self.height
        pad = dp(20)
        inner_w = w - pad * 2
        inner_h = h - pad * 2

        max_debt = max((d["debt"] for d in self.history), default=1)
        max_debt = max(1, max_debt)
        n = len(self.history)

        with self.canvas:
            # Background
            Color(0.04, 0.06, 0.12, 1)
            RoundedRectangle(
                pos=self.pos,
                size=self.size,
                radius=[8]
            )

            # Grid lines
            for i in range(5):
                y = self.y + pad + (i / 4) * inner_h
                Color(0.1, 0.16, 0.28, 1)
                Line(points=[
                    self.x + pad, y,
                    self.x + w - pad, y
                ], width=1)

            if n < 2:
                return

            # Debt line
            points = []
            for i, d in enumerate(self.history):
                x = self.x + pad + (i / (n - 1)) * inner_w
                norm = 1 - (d["debt"] / max_debt)
                y = self.y + pad + norm * inner_h
                points.extend([x, y])

            # Fill under line
            fill_points = [self.x + pad, self.y + pad]
            fill_points.extend(points)
            fill_points.extend([
                self.x + w - pad, self.y + pad])
            Color(1.0, 0.27, 0.4, 0.15)
            from kivy.graphics import Mesh
            # Draw as line only — mesh complexity avoided
            Color(1.0, 0.27, 0.4, 0.9)
            Line(points=points, width=2)

            # Dots at each point
            for i in range(0, len(points), 2):
                px, py = points[i], points[i+1]
                Color(1.0, 0.27, 0.4, 1)
                from kivy.graphics import Ellipse
                Ellipse(pos=(px-3, py-3), size=(6, 6))

            # Checkpoint markers D1, D3, D7, D14
            checkpoints = {0: "D1", 2: "D3", 6: "D7", 13: "D14"}
            for idx, label in checkpoints.items():
                if idx < n:
                    x = self.x + pad + (idx / (n-1)) * inner_w
                    Color(0.29, 0.62, 1.0, 0.6)
                    Line(points=[x, self.y + pad,
                                 x, self.y + pad + inner_h],
                         width=1, dash_length=4, dash_offset=4)


# ── Attention Score Arc ───────────────────────────────────────────

class AttentionScoreWidget(Widget):
    """Circular attention score display."""

    def __init__(self, score, **kwargs):
        super().__init__(**kwargs)
        self.score = score
        self.bind(size=self._draw, pos=self._draw)

    def _draw(self, *args):
        self.canvas.clear()
        w, h = self.width, self.height
        cx = self.x + w / 2
        cy = self.y + h / 2
        r = min(w, h) / 2 - dp(8)

        with self.canvas:
            # Background arc
            Color(0.1, 0.16, 0.28, 1)
            from kivy.graphics import Ellipse, Line
            Line(circle=(cx, cy, r), width=dp(8))

            # Score arc
            if self.score >= 80:
                Color(0, 1, 0.53, 1)
            elif self.score >= 50:
                Color(1, 0.87, 0, 1)
            else:
                Color(1, 0.27, 0.4, 1)

            angle = (self.score / 100) * 360
            Line(
                circle=(cx, cy, r, 90, 90 + angle),
                width=dp(8)
            )


# ── Main Screen ───────────────────────────────────────────────────

class DeeCadenceScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c(DC_BG)
        self._built = False
        self._refresh_event = None
        self._current_view = "home"

        # Session state
        self._active_session_id = None
        self._active_blocks = None
        self._current_block = 0
        self._energy_scores = []
        self._session_clock = None
        self._session_timer = 0
        self._in_break = False
        self._break_timer = 0
        self._phase = "focus"  # focus | short_break | long_break

        # Input refs
        self._distraction_hours = 1.0
        self._distraction_type = DISTRACTION_TYPES[0]
        self._distraction_type_btn = None
        self._distraction_menu = None
        self._task_name = None
        self._task_mins = None
        self._task_difficulty = 3
        self._difficulty_btn = None

        # Dynamic containers
        self._summary_container = None
        self._debt_container = None
        self._distraction_list = None
        self._session_list = None
        self._graph_container = None
        self._score_container = None
        self._content = None

    def on_enter(self):
        if not self._built:
            app = App.get_running_app()
            self.ctrl = DeeCadenceController(app.db)
            self._build_shell()
            self._built = True
        self._show_view("home")
        self._refresh_event = Clock.schedule_interval(
            lambda dt: self._update_data(), 5)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None
        if self._session_clock:
            self._session_clock.cancel()

    def _build_shell(self):
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "DeeCadence", "mind"))
        self._content = MDBoxLayout(orientation="vertical")
        root.add_widget(self._content)
        self.add_widget(root)

    def _show_view(self, view):
        self._current_view = view
        self._content.clear_widgets()
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

    def _update_data(self):
        if self._current_view == "home":
            self._show_view("home")

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
            spacing=dp(14),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Attention score ───────────────────────────────────────
        score_card = MDCard(
            orientation="horizontal",
            radius=[12], elevation=0,
            padding=[dp(16), dp(14)],
            size_hint_y=None, height=dp(100),
            md_bg_color=_c(DC_CARD),
            spacing=dp(16)
        )
        score_widget = AttentionScoreWidget(
            score=score,
            size_hint_x=None, width=dp(80)
        )
        score_card.add_widget(score_widget)

        score_info = MDBoxLayout(orientation="vertical")
        score_info.add_widget(MDLabel(
            text="ATTENTION SCORE",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(20)
        ))
        score_color = (DC_GREEN if score >= 80
                       else DC_GOLD if score >= 50
                       else DC_RED)
        score_info.add_widget(MDLabel(
            text=f"{score}",
            font_style="H3",
            theme_text_color="Custom",
            text_color=_c(score_color),
            bold=True,
            size_hint_y=None, height=dp(52)
        ))
        score_card.add_widget(score_info)
        body.add_widget(score_card)

        # ── Focus debt ────────────────────────────────────────────
        debt_card = MDCard(
            orientation="vertical",
            radius=[12], elevation=0,
            padding=[dp(16), dp(14)],
            size_hint_y=None,
            md_bg_color=_c(DC_CARD)
        )

        debt_top = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(28)
        )
        debt_top.add_widget(MDLabel(
            text="FOCUS DEBT",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(DC_DIM)
        ))
        debt_top.add_widget(MDLabel(
            text=debt_str,
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(DC_RED),
            halign="right", bold=True
        ))
        debt_card.add_widget(debt_top)

        if debt_mins > 0:
            # Emotional hook
            if debt_mins >= 120:
                hook = f"You've handed {debt_str} of your life to distraction. That's time you can't buy back — but you CAN earn it forward. Every focused minute is a payment. Start now."
            elif debt_mins >= 60:
                hook = f"An hour lost. Your future self is waiting for you to show up. One focused session changes the trajectory. Begin."
            else:
                hook = f"{debt_str} of drift. Small leaks sink ships. Seal it — one session at a time."

            debt_card.add_widget(MDLabel(
                text=hook,
                font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(TEXT),
                size_hint_y=None, height=dp(60)
            ))

            # Debt bar
            max_ref = max(debt_mins, 120)
            debt_pct = min(100, (debt_mins / max_ref) * 100)
            debt_bar = MDProgressBar(
                value=debt_pct,
                color=_c(DC_RED),
                size_hint_y=None, height=dp(8)
            )
            debt_card.add_widget(debt_bar)
            debt_card.height = dp(140)
        else:
            debt_card.add_widget(MDLabel(
                text="✓ No focus debt. You're in the clear.",
                font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(DC_GREEN),
                size_hint_y=None, height=dp(28)
            ))
            debt_card.height = dp(80)

        body.add_widget(debt_card)

        # ── Action buttons ────────────────────────────────────────
        if has_active:
            resume_btn = MDRaisedButton(
                text="▶  RESUME SESSION",
                md_bg_color=_c(DC_ACCENT),
                size_hint_y=None, height=dp(52)
            )
            resume_btn.bind(
                on_release=lambda x: self._resume_active())
            body.add_widget(resume_btn)
        else:
            btn_row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(10),
                size_hint_y=None, height=dp(52)
            )
            focus_btn = MDRaisedButton(
                text="🎯  START SESSION",
                md_bg_color=_c(DC_ACCENT),
                size_hint_x=0.5
            )
            focus_btn.bind(
                on_release=lambda x: self._show_view("session_setup"))
            distract_btn = MDRaisedButton(
                text="⚠  LOG DISTRACTION",
                md_bg_color=_c(DC_RED),
                size_hint_x=0.5
            )
            distract_btn.bind(
                on_release=lambda x: self._show_view("distraction"))
            btn_row.add_widget(focus_btn)
            btn_row.add_widget(distract_btn)
            body.add_widget(btn_row)

        stats_btn = MDFlatButton(
            text="📊  VIEW STATS & GRAPH →",
            theme_text_color="Custom",
            text_color=_c(DC_ACCENT),
            size_hint_y=None, height=dp(40)
        )
        stats_btn.bind(
            on_release=lambda x: self._show_view("stats"))
        body.add_widget(stats_btn)

        # ── Recent sessions ───────────────────────────────────────
        sessions = self.ctrl.get_recent_sessions(3)
        if sessions:
            body.add_widget(MDLabel(
                text="RECENT SESSIONS",
                font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(DC_DIM),
                size_hint_y=None, height=dp(24)
            ))
            for s in sessions:
                done = s["blocks_done"]
                total_blocks = 4
                color = DC_GREEN if s["completed"] else DC_GOLD
                body.add_widget(self._session_row(
                    s["task_name"],
                    f"Block {done}/{total_blocks} · "
                    f"{s['total_mins']}mins · "
                    f"D{s['difficulty']}",
                    s["date"], color
                ))

        root.add_widget(body)
        return root

    # ── DISTRACTION LOG ───────────────────────────────────────────

    def _build_distraction(self):
        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(16), spacing=dp(14)
        )

        back_btn = MDFlatButton(
            text="← Back",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(36)
        )
        back_btn.bind(
            on_release=lambda x: self._show_view("home"))
        root.add_widget(back_btn)

        root.add_widget(MDLabel(
            text="⚠  LOG DISTRACTION",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(DC_RED), bold=True,
            size_hint_y=None, height=dp(36)
        ))

        # Hours slider
        root.add_widget(MDLabel(
            text="Hours lost to distraction today:",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(TEXT),
            size_hint_y=None, height=dp(24)
        ))

        self._slider_label = MDLabel(
            text=f"{self._distraction_hours:.1f} hours  →  "
                 f"{int(self._distraction_hours * 60)} minutes lost",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(DC_RED), bold=True,
            size_hint_y=None, height=dp(28),
            halign="center"
        )
        root.add_widget(self._slider_label)

        slider = MDSlider(
            min=0.25, max=12, value=self._distraction_hours,
            step=0.25,
            size_hint_y=None, height=dp(44)
        )
        slider.bind(value=self._on_slider_change)
        root.add_widget(slider)

        # Debt preview
        self._debt_preview = MDLabel(
            text=self._debt_preview_text(),
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(DC_RED),
            size_hint_y=None, height=dp(36),
            halign="center"
        )
        root.add_widget(self._debt_preview)

        # Distraction type
        root.add_widget(MDLabel(
            text="What stole your focus?",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(TEXT),
            size_hint_y=None, height=dp(24)
        ))

        self._distraction_type_btn = MDRaisedButton(
            text=self._distraction_type,
            md_bg_color=_c(PANEL),
            size_hint_y=None, height=dp(44)
        )
        menu_items = [
            {
                "text": t,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=t: self._set_distraction_type(x)
            }
            for t in DISTRACTION_TYPES
        ]
        self._distraction_menu = MDDropdownMenu(
            caller=self._distraction_type_btn,
            items=menu_items,
            width_mult=4
        )
        self._distraction_type_btn.bind(
            on_release=lambda x: self._distraction_menu.open())
        root.add_widget(self._distraction_type_btn)

        # Emotional hook
        hook_card = MDCard(
            orientation="vertical",
            radius=[10], elevation=0,
            padding=[dp(16), dp(12)],
            size_hint_y=None, height=dp(80),
            md_bg_color=_c("#1a0a0a")
        )
        hook_card.add_widget(MDLabel(
            text="Every minute you log is a minute you own.\nAwareness is the first payment.",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(DC_GOLD),
            halign="center"
        ))
        root.add_widget(hook_card)

        log_btn = MDRaisedButton(
            text="LOG DISTRACTION",
            md_bg_color=_c(DC_RED),
            size_hint_y=None, height=dp(52)
        )
        log_btn.bind(on_release=lambda x: self._log_distraction())
        root.add_widget(log_btn)

        return root

    def _debt_preview_text(self):
        mins = int(self._distraction_hours * 60)
        if mins >= 60:
            hrs = mins / 60
            return f"Focus Debt: {hrs:.1f} hours"
        return f"Focus Debt: {mins} minutes"

    def _on_slider_change(self, slider, value):
        self._distraction_hours = round(value, 2)
        try:
            mins = int(self._distraction_hours * 60)
            self._slider_label.text = (
                f"{self._distraction_hours:.1f} hours  →  "
                f"{mins} minutes lost")
            self._debt_preview.text = self._debt_preview_text()
        except Exception:
            pass

    def _set_distraction_type(self, type_):
        self._distraction_type = type_
        self._distraction_type_btn.text = type_
        self._distraction_menu.dismiss()

    def _log_distraction(self):
        ok, msg = self.ctrl.log_distraction(
            self._distraction_hours,
            self._distraction_type)
        if ok:
            self._show_view("home")

    # ── SESSION SETUP ─────────────────────────────────────────────

    def _build_session_setup(self):
        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(16), spacing=dp(12)
        )

        back_btn = MDFlatButton(
            text="← Back",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(36)
        )
        back_btn.bind(
            on_release=lambda x: self._show_view("home"))
        root.add_widget(back_btn)

        root.add_widget(MDLabel(
            text="🎯  NEW FOCUS SESSION",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(DC_ACCENT), bold=True,
            size_hint_y=None, height=dp(36)
        ))

        self._task_name = MDTextField(
            hint_text="What are you working on?",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        root.add_widget(self._task_name)

        self._task_mins = MDTextField(
            hint_text="Total session duration (minutes, min 4)",
            input_filter="int",
            mode="rectangle",
            size_hint_y=None, height=dp(44)
        )
        root.add_widget(self._task_mins)

        # Difficulty selector
        root.add_widget(MDLabel(
            text="Task difficulty:",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(TEXT),
            size_hint_y=None, height=dp(24)
        ))

        diff_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(8),
            size_hint_y=None, height=dp(44)
        )
        for d in range(1, 6):
            btn = MDRaisedButton(
                text=str(d),
                md_bg_color=_c(DC_ACCENT if d == self._task_difficulty
                               else PANEL),
                size_hint_x=0.2,
                font_size="13sp"
            )
            btn.bind(on_release=lambda x, dv=d:
                     self._set_difficulty(dv))
            diff_row.add_widget(btn)
        self._diff_row = diff_row
        root.add_widget(diff_row)

        self._diff_label = MDLabel(
            text=DIFFICULTY_LABELS[self._task_difficulty],
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(20)
        )
        root.add_widget(self._diff_label)

        # Block preview
        self._block_preview = MDLabel(
            text="Enter duration to see block breakdown",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(40)
        )
        root.add_widget(self._block_preview)
        self._task_mins.bind(
            text=lambda i, v: self._update_block_preview(v))

        start_btn = MDRaisedButton(
            text="BEGIN SESSION",
            md_bg_color=_c(DC_ACCENT),
            size_hint_y=None, height=dp(52)
        )
        start_btn.bind(on_release=lambda x: self._start_session())
        root.add_widget(start_btn)

        return root

    def _set_difficulty(self, val):
        self._task_difficulty = val
        try:
            self._diff_label.text = DIFFICULTY_LABELS[val]
            for i, btn in enumerate(
                    self._diff_row.children[::-1]):
                btn.md_bg_color = _c(
                    DC_ACCENT if i + 1 == val else PANEL)
        except Exception:
            pass

    def _update_block_preview(self, val):
        try:
            mins = int(val)
            if mins >= 4:
                b = calculate_blocks(mins, self._task_difficulty)
                self._block_preview.text = (
                    f"4 blocks × {b['focus_mins']}min focus  "
                    f"· {b['short_break']}min short break  "
                    f"· {b['long_break']}min long break"
                )
        except Exception:
            self._block_preview.text = "Enter duration to see breakdown"

    def _start_session(self):
        session_id, result = self.ctrl.start_session(
            self._task_name.text,
            self._task_mins.text,
            self._task_difficulty
        )
        if session_id is None:
            return
        self._active_session_id = session_id
        self._active_blocks = result
        self._current_block = 0
        self._energy_scores = []
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
        self._show_view("session_active")
        self._start_block_timer()

    # ── SESSION ACTIVE ────────────────────────────────────────────

    def _build_session_active(self):
        if not self._active_blocks:
            self._show_view("home")
            return MDBoxLayout()

        b = self._active_blocks
        block_num = self._current_block + 1

        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(16), spacing=dp(14)
        )

        # Task name
        session = self.ctrl.get_active_session()
        task = session["task_name"] if session else "Focus"

        root.add_widget(MDLabel(
            text=task,
            font_style="H5",
            theme_text_color="Custom",
            text_color=_c(DC_ACCENT), bold=True,
            size_hint_y=None, height=dp(44),
            halign="center"
        ))

        # Block indicator dots
        dots_row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(24),
            spacing=dp(8)
        )
        for i in range(4):
            color = (DC_ACCENT if i == self._current_block
                     else DC_GREEN if i < self._current_block
                     else DC_DIM)
            dots_row.add_widget(MDLabel(
                text="●",
                font_style="H6",
                theme_text_color="Custom",
                text_color=_c(color),
                halign="center"
            ))
        root.add_widget(dots_row)

        # Phase label
        phase_text = (
            "🔥 FOCUS" if self._phase == "focus"
            else "☕ SHORT BREAK" if self._phase == "short_break"
            else "🌿 LONG BREAK"
        )
        phase_color = (DC_ACCENT if self._phase == "focus"
                       else DC_GREEN)
        self._phase_label = MDLabel(
            text=phase_text,
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(phase_color),
            size_hint_y=None, height=dp(36),
            halign="center"
        )
        root.add_widget(self._phase_label)

        # Timer display
        self._timer_label = MDLabel(
            text=self._format_time(self._session_timer),
            font_style="H2",
            theme_text_color="Custom",
            text_color=_c(DC_ACCENT),
            size_hint_y=None, height=dp(80),
            halign="center"
        )
        root.add_widget(self._timer_label)

        # Block info
        self._block_info_label = MDLabel(
            text=f"Block {block_num} of 4  ·  "
                 f"{b['focus_mins']}min focus",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(24),
            halign="center"
        )
        root.add_widget(self._block_info_label)

        # Progress bar
        self._session_progress = MDProgressBar(
            value=0,
            color=_c(DC_ACCENT),
            size_hint_y=None, height=dp(6)
        )
        root.add_widget(self._session_progress)

        # Abandon button
        abandon_btn = MDFlatButton(
            text="✕  Abandon session",
            theme_text_color="Custom",
            text_color=_c(DC_RED),
            size_hint_y=None, height=dp(36)
        )
        abandon_btn.bind(
            on_release=lambda x: self._abandon_session())
        root.add_widget(abandon_btn)

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

        # Update UI
        try:
            self._timer_label.text = self._format_time(
                self._session_timer)
            total = (b["focus_mins"] * 60
                     if self._phase == "focus"
                     else b["short_break"] * 60
                     if self._phase == "short_break"
                     else b["long_break"] * 60)
            elapsed = total - self._session_timer
            pct = min(100, (elapsed / max(1, total)) * 100)
            self._session_progress.value = pct
        except Exception:
            pass

        if self._session_timer <= 0:
            self._session_clock.cancel()
            self._on_phase_complete()

    def _on_phase_complete(self):
        if self._phase == "focus":
            # Block complete — ask for energy
            self._show_view("energy_prompt")
        elif self._phase in ("short_break", "long_break"):
            # Break done — start next focus block
            self._phase = "focus"
            self._show_view("session_active")
            self._start_block_timer()

    def _on_energy_recorded(self, score):
        self._energy_scores.append(score)
        self._current_block += 1

        self.ctrl.complete_block(
            self._active_session_id,
            self._current_block,
            self._energy_scores
        )

        if self._current_block >= 4:
            # All blocks done
            self.ctrl.complete_session(
                self._active_session_id,
                self._current_block,
                self._energy_scores
            )
            self._show_view("home")
        else:
            # Next break
            self._phase = "short_break"
            self._show_view("session_active")
            self._start_block_timer()

    def _abandon_session(self):
        if self._active_session_id:
            self.ctrl.abandon_session(self._active_session_id)
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
            padding=dp(24), spacing=dp(16)
        )

        root.add_widget(MDLabel(
            text=f"Block {self._current_block + 1} Complete ✓",
            font_style="H5",
            theme_text_color="Custom",
            text_color=_c(DC_GREEN), bold=True,
            size_hint_y=None, height=dp(44),
            halign="center"
        ))

        root.add_widget(MDLabel(
            text="How's your energy right now?",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(TEXT),
            size_hint_y=None, height=dp(32),
            halign="center"
        ))

        energy_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(8),
            size_hint_y=None, height=dp(56)
        )
        labels = ["💀", "😴", "😐", "😊", "⚡"]
        for i, emoji in enumerate(labels):
            score = i + 1
            btn = MDRaisedButton(
                text=emoji,
                md_bg_color=_c(PANEL),
                size_hint_x=0.2,
                font_size="20sp"
            )
            btn.bind(
                on_release=lambda x, s=score:
                self._on_energy_recorded(s))
            energy_row.add_widget(btn)
        root.add_widget(energy_row)

        energy_labels = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(20)
        )
        for label in ["Dead", "Low", "OK", "Good", "Peak"]:
            energy_labels.add_widget(MDLabel(
                text=label,
                font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(DC_DIM),
                halign="center",
                size_hint_x=0.2
            ))
        root.add_widget(energy_labels)

        return root

    # ── STATS VIEW ────────────────────────────────────────────────

    def _build_stats(self):
        root = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(14),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        back_btn = MDFlatButton(
            text="← Back",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(36)
        )
        back_btn.bind(
            on_release=lambda x: self._show_view("home"))
        body.add_widget(back_btn)

        body.add_widget(MDLabel(
            text="📊  FOCUS ANALYTICS",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(DC_ACCENT), bold=True,
            size_hint_y=None, height=dp(36)
        ))

        # Attention score history
        body.add_widget(MDLabel(
            text="ATTENTION SCORE — 14 DAYS",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(24)
        ))

        score = self.ctrl.get_attention_score()
        score_widget = AttentionScoreWidget(
            score=score,
            size_hint_y=None, height=dp(120)
        )
        body.add_widget(score_widget)

        # Debt repayment graph
        body.add_widget(MDLabel(
            text="FOCUS DEBT — REPAYMENT GRAPH",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(DC_DIM),
            size_hint_y=None, height=dp(24)
        ))

        history = self.ctrl.get_debt_history()
        graph = DebtGraphWidget(
            history=history,
            size_hint_y=None, height=dp(160)
        )
        body.add_widget(graph)

        # Checkpoint labels
        checkpoint_row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(20)
        )
        for label in ["Day 1", "Day 3", "Day 7", "Day 14"]:
            checkpoint_row.add_widget(MDLabel(
                text=label,
                font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(DC_DIM),
                halign="center"
            ))
        body.add_widget(checkpoint_row)

        # Session summary
        sessions = self.ctrl.get_recent_sessions(7)
        if sessions:
            body.add_widget(MDLabel(
                text="RECENT SESSIONS",
                font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(DC_DIM),
                size_hint_y=None, height=dp(24)
            ))
            for s in sessions:
                color = DC_GREEN if s["completed"] else DC_GOLD
                avg_energy = (
                    sum(s["energy_scores"]) /
                    len(s["energy_scores"])
                    if s["energy_scores"] else 0
                )
                body.add_widget(self._session_row(
                    s["task_name"],
                    f"D{s['difficulty']} · "
                    f"{s['blocks_done']}/4 blocks · "
                    f"Avg energy {avg_energy:.1f}",
                    s["date"], color
                ))

        root.add_widget(body)
        return root

    # ── Helpers ───────────────────────────────────────────────────

    def _format_time(self, seconds):
        seconds = max(0, int(seconds))
        m = seconds // 60
        s = seconds % 60
        return f"{m:02d}:{s:02d}"

    def _session_row(self, title, subtitle, date, color):
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(56),
            md_bg_color=_c(DC_CARD), spacing=dp(8)
        )
        info = MDBoxLayout(
            orientation="vertical", size_hint_x=0.75)
        info.add_widget(MDLabel(
            text=title, font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(color), size_hint_y=0.55
        ))
        info.add_widget(MDLabel(
            text=f"{subtitle}  ·  {date}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DC_DIM), size_hint_y=0.45
        ))
        row.add_widget(info)
        return row
    

