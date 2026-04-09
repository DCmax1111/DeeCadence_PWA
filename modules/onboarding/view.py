"""
Dee_Cistem Onboarding Flow
3 screens. Sets emotional context, picks starting stats,
explains the rank system. Runs once on first launch.
"""
from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivymd.uix.textfield import MDTextField
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from kivy.graphics import Color, RoundedRectangle, Line
from shared.theme import c, t, hex_color, R, rank_color
from shared.components import spacer, primary_btn


def _c(h): return hex_color(h)


# ── The six stats the user can prioritise ─────────────────────────

ALL_STATS = [
    {
        "name":  "Financial",
        "key":   "financial",
        "desc":  "Income, expenses, cashflow",
        "icon":  "F",
    },
    {
        "name":  "Spirit",
        "key":   "spirit",
        "desc":  "Prayer, Bible, leadership",
        "icon":  "S",
    },
    {
        "name":  "Mind",
        "key":   "mind",
        "desc":  "Focus, clarity, journaling",
        "icon":  "M",
    },
    {
        "name":  "Knowledge",
        "key":   "knowledge",
        "desc":  "Reading, study, skills",
        "icon":  "K",
    },
    {
        "name":  "Dexterity",
        "key":   "dexterity",
        "desc":  "Drawing, design, craft",
        "icon":  "D",
    },
    {
        "name":  "Energy",
        "key":   "energy",
        "desc":  "Sleep, water, exercise",
        "icon":  "E",
    },
]

RANK_EXPLAINERS = [
    ("E", "rank_e", "Starting rank. Everyone begins here."),
    ("D", "rank_d", "You're showing up consistently."),
    ("C", "rank_c", "No regression. Momentum is building."),
    ("B", "rank_b", "You're improving, not just repeating."),
    ("A", "rank_a", "Mastery is visible. Others notice."),
    ("S", "rank_s", "Elite consistency. Rare territory."),
    ("SS","rank_ss","Legendary. Earned, never given."),
]


class OnboardingScreen(MDScreen):
    """
    Manages 3 internal views via view-swap.
    view_1 — emotional frame + name
    view_2 — pick top 3 stats
    view_3 — rank system explainer
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._built = False
        self._current_step = 1
        self._user_name = ""
        self._selected_stats = set()
        self._content = None
        self._name_field = None
        self._stat_cards = {}

    def on_enter(self):
        self.md_bg_color = c("bg")
        if not self._built:
            self._build_shell()
            self._built = True
        self._show_step(1)

    def _build_shell(self):
        root = MDBoxLayout(orientation="vertical")

        # Progress dots — 3 steps
        self._dots_row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None,
            height=dp(48),
            padding=[dp(16), dp(12)],
            spacing=dp(8),
            md_bg_color=c("bg2")
        )
        self._dots = []
        for i in range(3):
            dot = Widget(
                size_hint=(None, None),
                size=(dp(8), dp(8))
            )
            with dot.canvas:
                Color(*c("border2"))
                RoundedRectangle(
                    pos=dot.pos,
                    size=dot.size,
                    radius=[4]
                )
            self._dots.append(dot)
            self._dots_row.add_widget(dot)

        # Spacer to push dots left
        self._dots_row.add_widget(Widget())
        root.add_widget(self._dots_row)

        self._content = MDBoxLayout(
            orientation="vertical")
        root.add_widget(self._content)
        self.add_widget(root)

    def _update_dots(self, step):
        for i, dot in enumerate(self._dots):
            dot.canvas.clear()
            with dot.canvas:
                active = i < step
                Color(*(_c(t("accent"))
                        if active else c("border2")))
                RoundedRectangle(
                    pos=dot.pos,
                    size=(dp(24) if active else dp(8),
                          dp(8)),
                    radius=[4]
                )

    def _show_step(self, step):
        self._current_step = step
        self._content.clear_widgets()
        self._update_dots(step)
        if step == 1:
            self._content.add_widget(
                self._build_step1())
        elif step == 2:
            self._content.add_widget(
                self._build_step2())
        elif step == 3:
            self._content.add_widget(
                self._build_step3())

    # ── Step 1 — Identity + Name ──────────────────────────────────

    def _build_step1(self):
        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(28), dp(32), dp(28), dp(24)],
            spacing=dp(0),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # Main headline
        body.add_widget(MDLabel(
            text="Which version of\nyourself are\nyou building?",
            font_style="H3",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=None,
            height=dp(140)
        ))

        body.add_widget(spacer(16))

        body.add_widget(MDLabel(
            text="Dee_Cistem tracks every dimension of "
                 "your growth — body, mind, spirit, "
                 "finances, knowledge, and craft. "
                 "Your rank reflects who you're becoming, "
                 "not just what you've done.",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None,
            height=dp(100)
        ))

        body.add_widget(spacer(32))

        # Name field
        body.add_widget(MDLabel(
            text="What should we call you?",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None,
            height=dp(24)
        ))
        body.add_widget(spacer(8))

        self._name_field = MDTextField(
            hint_text="Your name",
            mode="rectangle",
            size_hint_y=None,
            height=dp(52),
            line_color_normal=_c(t("border")),
            line_color_focus=_c(t("accent")),
            hint_text_color_normal=_c(t("text3")),
            hint_text_color_focus=_c(t("accent")),
            text_color_normal=_c(t("text")),
            text_color_focus=_c(t("text")),
            fill_color_normal=_c(t("surface")),
            fill_color_focus=_c(t("surface")),
            radius=[dp(10), dp(10),
                    dp(10), dp(10)]
        )
        # Pre-fill if returning
        app = App.get_running_app()
        if hasattr(app, 'user_name') and app.user_name:
            self._name_field.text = app.user_name
        body.add_widget(self._name_field)

        body.add_widget(spacer(32))

        next_btn = MDRaisedButton(
            text="Let's go  >",
            md_bg_color=_c(t("accent")),
            size_hint_y=None,
            height=dp(56),
            font_size="16sp"
        )
        next_btn.bind(
            on_release=lambda x: self._step1_next())
        body.add_widget(next_btn)

        scroll.add_widget(body)
        return scroll

    def _step1_next(self):
        name = self._name_field.text.strip()
        if name:
            self._user_name = name
            app = App.get_running_app()
            app.user_name = name
            # Persist name
            try:
                app.db.execute(
                    """INSERT OR REPLACE INTO
                       app_settings (key, value)
                       VALUES ('user_name', ?)""",
                    (name,))
            except Exception:
                pass
        self._show_step(2)

    # ── Step 2 — Pick 3 stats ─────────────────────────────────────

    def _build_step2(self):
        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(24), dp(28), dp(24), dp(24)],
            spacing=dp(0),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        body.add_widget(MDLabel(
            text="Pick your top 3\nfocus areas",
            font_style="H4",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=None,
            height=dp(96)
        ))
        body.add_widget(MDLabel(
            text="You'll track all six, but these "
                 "three will appear as your priority "
                 "stats on the dashboard.",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None,
            height=dp(52)
        ))
        body.add_widget(spacer(20))

        self._stat_cards = {}
        for stat in ALL_STATS:
            card = self._stat_select_card(stat)
            self._stat_cards[stat["name"]] = card
            body.add_widget(card)
            body.add_widget(spacer(8))

        body.add_widget(spacer(16))

        self._step2_btn = MDRaisedButton(
            text="Continue  >",
            md_bg_color=_c(t("accent")),
            size_hint_y=None,
            height=dp(56),
            font_size="16sp"
        )
        self._step2_btn.bind(
            on_release=lambda x: self._step2_next())
        body.add_widget(self._step2_btn)

        body.add_widget(spacer(8))
        skip = MDFlatButton(
            text="Skip — I'll set this up later",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None,
            height=dp(40)
        )
        skip.bind(
            on_release=lambda x: self._show_step(3))
        body.add_widget(skip)

        scroll.add_widget(body)
        return scroll

    def _stat_select_card(self, stat):
        is_selected = stat["name"] in self._selected_stats
        color = t(stat["key"])
        bg = (_c(color + "22") if is_selected
              else c("card"))

        card = MDCard(
            orientation="horizontal",
            radius=R["md"],
            elevation=0,
            padding=[dp(16), dp(14)],
            size_hint_y=None,
            height=dp(68),
            md_bg_color=bg,
            spacing=dp(14)
        )

        # Icon badge
        badge = MDCard(
            radius=[8],
            elevation=0,
            padding=[dp(4), dp(4)],
            size_hint=(None, None),
            size=(dp(44), dp(44)),
            md_bg_color=_c(color + "33")
        )
        badge.add_widget(MDLabel(
            text=stat["icon"],
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(color),
            halign="center",
            valign="middle",
            bold=True
        ))
        card.add_widget(badge)

        # Info
        info = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.75
        )
        info.add_widget(MDLabel(
            text=stat["name"],
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(color) if is_selected
            else c("text"),
            bold=True,
            size_hint_y=0.55
        ))
        info.add_widget(MDLabel(
            text=stat["desc"],
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=0.45
        ))
        card.add_widget(info)

        # Check indicator
        check = MDLabel(
            text="✓" if is_selected else "",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(color),
            halign="right",
            size_hint_x=0.1
        )
        card.add_widget(check)

        sname = stat["name"]
        card.bind(on_release=lambda x,
                  n=sname: self._toggle_stat(n))
        return card

    def _toggle_stat(self, name):
        if name in self._selected_stats:
            self._selected_stats.discard(name)
        else:
            if len(self._selected_stats) >= 3:
                return  # Max 3
            self._selected_stats.add(name)

        # Rebuild step 2 to reflect selection
        self._show_step(2)

    def _step2_next(self):
        # Save priority stats
        app = App.get_running_app()
        try:
            priority = ",".join(self._selected_stats)
            app.db.execute(
                """INSERT OR REPLACE INTO
                   app_settings (key, value)
                   VALUES ('priority_stats', ?)""",
                (priority,))
        except Exception:
            pass
        self._show_step(3)

    # ── Step 3 — Rank explainer ───────────────────────────────────

    def _build_step3(self):
        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(24), dp(28), dp(24), dp(24)],
            spacing=dp(0),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        name = self._user_name or "Hunter"
        body.add_widget(MDLabel(
            text=f"{name}, your\nstarting rank is E.",
            font_style="H4",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=None,
            height=dp(100)
        ))

        body.add_widget(MDLabel(
            text="Every rank must be earned through "
                 "real consistency. Logging alone "
                 "doesn't move you up — improvement "
                 "does. There are no participation "
                 "trophies here.",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None,
            height=dp(80)
        ))

        body.add_widget(spacer(20))

        # Rank ladder
        for rank, color_key, desc in RANK_EXPLAINERS:
            is_current = rank == "E"
            row = MDCard(
                orientation="horizontal",
                radius=R["sm"],
                elevation=0,
                padding=[dp(14), dp(10)],
                size_hint_y=None,
                height=dp(52),
                md_bg_color=(
                    _c(t(color_key) + "22")
                    if is_current else c("card")),
                spacing=dp(14)
            )

            badge = MDCard(
                radius=[6],
                elevation=0,
                padding=[dp(2), dp(2)],
                size_hint=(None, None),
                size=(dp(36), dp(36)),
                md_bg_color=_c(t(color_key) + "33")
            )
            badge.add_widget(MDLabel(
                text=rank,
                font_style="Body1",
                theme_text_color="Custom",
                text_color=_c(t(color_key)),
                halign="center",
                valign="middle",
                bold=True
            ))
            row.add_widget(badge)

            right = MDBoxLayout(orientation="vertical")
            right.add_widget(MDLabel(
                text=desc,
                font_style="Body2",
                theme_text_color="Custom",
                text_color=(c("text") if is_current
                            else c("text2")),
                bold=is_current,
                size_hint_y=0.6
            ))
            if is_current:
                right.add_widget(MDLabel(
                    text="You are here",
                    font_style="Caption",
                    theme_text_color="Custom",
                    text_color=_c(t(color_key)),
                    size_hint_y=0.4
                ))
            row.add_widget(right)
            body.add_widget(row)
            body.add_widget(spacer(4))

        body.add_widget(spacer(24))

        begin_btn = MDRaisedButton(
            text="Begin my journey  >",
            md_bg_color=_c(t("accent")),
            size_hint_y=None,
            height=dp(56),
            font_size="16sp"
        )
        begin_btn.bind(
            on_release=lambda x: self._finish())
        body.add_widget(begin_btn)

        scroll.add_widget(body)
        return scroll

    def _finish(self):
        """Mark onboarding complete and go to navigation."""
        app = App.get_running_app()
        try:
            app.db.execute(
                """INSERT OR REPLACE INTO
                   app_settings (key, value)
                   VALUES ('onboarding_complete', '1')""")
        except Exception:
            pass
        app.onboarding_complete = True
        self.manager.current = "navigation"

