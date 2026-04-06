"""
Dee_Cistem Component Library v2
Clean, mobile-ready, app-standard components.
"""
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDFlatButton, MDRaisedButton
from kivymd.uix.card import MDCard
from kivymd.uix.textfield import MDTextField
from kivy.uix.widget import Widget
from kivy.uix.boxlayout import BoxLayout
from kivy.graphics import (
    Color, RoundedRectangle,
    Rectangle, Line, Ellipse
)
from kivy.metrics import dp
from kivy.clock import Clock
from shared.theme import (
    c, t, hex_color, get_rank,
    stat_color, rank_color, R, SP
)
import datetime


def _c(h): return hex_color(h)


# ── App font helper ───────────────────────────────────────────────

def font(): 
    try:
        from kivy.app import App
        return getattr(App.get_running_app(), 'font_name', 'Roboto')
    except Exception:
        return 'Roboto'


# ── Time-aware greeting ───────────────────────────────────────────

def get_greeting(name=""):
    hour = datetime.datetime.now().hour
    if hour < 12:
        prefix = "Good morning"
    elif hour < 17:
        prefix = "Good afternoon"
    else:
        prefix = "Good evening"
    return f"{prefix}, {name}" if name else prefix


# ── Top navigation bar ────────────────────────────────────────────

def top_nav(screen_ref, title, color_key="accent",
            back_screen="navigation", show_back=True):
    nav = MDBoxLayout(
        orientation="horizontal",
        size_hint_y=None,
        height=dp(56),
        padding=[dp(4), 0, dp(16), 0],
        spacing=dp(0),
        md_bg_color=c("bg2")
    )

    if show_back:
        back = MDFlatButton(
            text="<",
            font_size="20sp",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_x=None,
            width=dp(48)
        )
        back.bind(on_release=lambda x: setattr(
            screen_ref.manager, "current", back_screen))
        nav.add_widget(back)

    nav.add_widget(MDLabel(
        text=title,
        font_style="H6",
        theme_text_color="Custom",
        text_color=_c(t(color_key)),
        bold=True,
        valign="center"
    ))

    return nav


# ── Input field (app-standard) ────────────────────────────────────

def input_field(hint, input_filter=None,
                multiline=False, height=dp(52)):
    """
    Mobile-standard input field.
    Filled background, rounded, properly sized for thumbs.
    """
    field = MDTextField(
        hint_text=hint,
        mode="rectangle",
        input_filter=input_filter,
        multiline=multiline,
        size_hint_y=None,
        height=height,
        line_color_normal=_c(t("border")),
        line_color_focus=_c(t("accent")),
        hint_text_color_normal=_c(t("text3")),
        hint_text_color_focus=_c(t("accent")),
        text_color_normal=_c(t("text")),
        text_color_focus=_c(t("text")),
        fill_color_normal=_c(t("surface")),
        fill_color_focus=_c(t("surface")),
        radius=[dp(10), dp(10), dp(10), dp(10)]
    )
    return field


# ── Section label ─────────────────────────────────────────────────

def section_label(text, top_space=True):
    box = MDBoxLayout(
        orientation="vertical",
        size_hint_y=None,
        height=dp(40) if top_space else dp(24)
    )
    if top_space:
        box.add_widget(Widget(
            size_hint_y=None, height=dp(8)))
    box.add_widget(MDLabel(
        text=text,
        font_style="Overline",
        theme_text_color="Custom",
        text_color=c("text3"),
        size_hint_y=None,
        height=dp(20),
        bold=True
    ))
    return box


# ── Spacer ────────────────────────────────────────────────────────

def spacer(h=8):
    return Widget(size_hint_y=None, height=dp(h))


# ── Divider ───────────────────────────────────────────────────────

def divider():
    d = Widget(size_hint_y=None, height=dp(1))
    with d.canvas:
        Color(*c("border"))
        Rectangle(pos=d.pos, size=(10000, dp(1)))
    return d


# ── Empty state ───────────────────────────────────────────────────

def empty_state(text, sub=None):
    box = MDBoxLayout(
        orientation="vertical",
        size_hint_y=None,
        height=dp(80),
        padding=[dp(16), dp(16)]
    )
    box.add_widget(MDLabel(
        text=text,
        font_style="Body1",
        theme_text_color="Custom",
        text_color=c("text3"),
        halign="center",
        valign="middle",
        size_hint_y=None,
        height=dp(32)
    ))
    if sub:
        box.add_widget(MDLabel(
            text=sub,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text4"),
            halign="center",
            size_hint_y=None,
            height=dp(24)
        ))
    return box


# ── Styled progress bar ───────────────────────────────────────────

class StyledBar(Widget):
    """Rounded progress bar."""

    def __init__(self, value, color_hex,
                 track_key="border2", **kwargs):
        super().__init__(**kwargs)
        self._value = value
        self._color_hex = color_hex
        self._track_key = track_key
        self.bind(size=self._draw, pos=self._draw)

    def set_value(self, val):
        self._value = val
        self._draw()

    def _draw(self, *args):
        self.canvas.clear()
        w, h = self.width, self.height
        if w <= 0 or h <= 0:
            return
        fill = max(0, min(1, self._value / 100)) * w
        r = h / 2
        with self.canvas:
            Color(*c(self._track_key))
            RoundedRectangle(
                pos=self.pos,
                size=(w, h),
                radius=[r]
            )
            if fill > dp(2):
                Color(*_c(self._color_hex))
                RoundedRectangle(
                    pos=self.pos,
                    size=(fill, h),
                    radius=[r]
                )


# ── Stat bar card ─────────────────────────────────────────────────

class StatBarCard(MDCard):
    def __init__(self, stat_name, value,
                 color_hex, rank, **kwargs):
        super().__init__(**kwargs)
        self.orientation = "horizontal"
        self.radius = R["md"]
        self.elevation = 0
        self.padding = [dp(16), dp(14), dp(16), dp(14)]
        self.size_hint_y = None
        self.height = dp(68)
        self.md_bg_color = c("card")
        self.spacing = dp(12)

        left = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.3
        )
        left.add_widget(MDLabel(
            text=stat_name,
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=0.55
        ))
        self._rank_lbl = MDLabel(
            text=f"Rank {rank}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(color_hex),
            size_hint_y=0.45
        )
        left.add_widget(self._rank_lbl)
        self.add_widget(left)

        mid = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.54,
            padding=[0, dp(20)]
        )
        self._bar = StyledBar(
            value=value,
            color_hex=color_hex,
            size_hint_y=None,
            height=dp(6)
        )
        mid.add_widget(self._bar)
        self.add_widget(mid)

        self._val_lbl = MDLabel(
            text=str(int(value)),
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(color_hex),
            halign="right",
            bold=True,
            size_hint_x=0.16
        )
        self.add_widget(self._val_lbl)

    def update(self, value, rank, color_hex):
        self._bar.set_value(value)
        self._val_lbl.text = str(int(value))
        self._val_lbl.color = _c(color_hex)
        self._rank_lbl.text = f"Rank {rank}"
        self._rank_lbl.color = _c(color_hex)


# ── Module card ───────────────────────────────────────────────────

class ModuleCard(MDCard):
    def __init__(self, label, desc, stat_text,
                 color_key, hover_hex, **kwargs):
        super().__init__(**kwargs)
        self._normal = c("card")
        self._pressed = _c(hover_hex)
        self.md_bg_color = self._normal
        self.orientation = "vertical"
        self.radius = R["lg"]
        self.elevation = 0
        self.padding = [dp(14), dp(14)]
        self.spacing = dp(4)
        self.bind(
            on_press=lambda x: setattr(
                self, 'md_bg_color', self._pressed),
            on_release=lambda x: setattr(
                self, 'md_bg_color', self._normal)
        )

        color_hex = t(color_key)

        self.add_widget(MDLabel(
            text=label,
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(color_hex),
            bold=True,
            size_hint_y=None,
            height=dp(24)
        ))
        self.add_widget(MDLabel(
            text=desc,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None,
            height=dp(18)
        ))
        self._stat_lbl = MDLabel(
            text=stat_text,
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(color_hex),
            size_hint_y=None,
            height=dp(16)
        )
        self.add_widget(self._stat_lbl)

        # Bottom accent line
        line = Widget(size_hint_y=None, height=dp(2))
        with line.canvas:
            Color(*_c(color_hex + "55"))
            RoundedRectangle(
                pos=line.pos,
                size=line.size,
                radius=[1]
            )
        line.bind(
            pos=lambda w, v, ch=color_hex: _redraw_line(w, ch),
            size=lambda w, v, ch=color_hex: _redraw_line(w, ch)
        )
        self.add_widget(line)

    def update_stat(self, text):
        self._stat_lbl.text = text


def _redraw_line(widget, color_hex):
    widget.canvas.clear()
    with widget.canvas:
        Color(*_c(color_hex + "55"))
        RoundedRectangle(
            pos=widget.pos,
            size=widget.size,
            radius=[1]
        )


# ── Summary card ──────────────────────────────────────────────────

def summary_card(label, value, color_key,
                 size_hint_x=1/3):
    card = MDCard(
        orientation="vertical",
        radius=R["md"],
        elevation=0,
        padding=[dp(12), dp(10)],
        size_hint_x=size_hint_x,
        size_hint_y=None,
        height=dp(72),
        md_bg_color=c("card")
    )
    card.add_widget(MDLabel(
        text=label,
        font_style="Overline",
        theme_text_color="Custom",
        text_color=c("text3"),
        halign="center",
        size_hint_y=0.4
    ))
    card.add_widget(MDLabel(
        text=str(value),
        font_style="Body1",
        theme_text_color="Custom",
        text_color=_c(t(color_key)),
        halign="center",
        bold=True,
        size_hint_y=0.6
    ))
    return card


# ── Log row ───────────────────────────────────────────────────────

def log_row(title, subtitle, color_key,
            on_delete=None, height=dp(62)):
    row = MDCard(
        orientation="horizontal",
        radius=R["md"],
        elevation=0,
        padding=[dp(0), dp(0), dp(0), dp(0)],
        size_hint_y=None,
        height=height,
        md_bg_color=c("card"),
        spacing=dp(0)
    )

    # Left accent bar
    accent = Widget(size_hint_x=None, width=dp(4))
    with accent.canvas:
        Color(*_c(t(color_key)))
        RoundedRectangle(
            pos=accent.pos,
            size=accent.size,
            radius=[2, 0, 0, 2]
        )
    accent.bind(
        pos=lambda w, v: _redraw_accent(w, color_key),
        size=lambda w, v: _redraw_accent(w, color_key)
    )
    row.add_widget(accent)

    inner = MDBoxLayout(
        orientation="horizontal",
        padding=[dp(12), dp(10), dp(4), dp(10)]
    )

    info = MDBoxLayout(
        orientation="vertical",
        size_hint_x=0.85 if on_delete else 1.0
    )
    info.add_widget(MDLabel(
        text=title,
        font_style="Body2",
        theme_text_color="Custom",
        text_color=c("text"),
        size_hint_y=0.55,
        bold=True
    ))
    info.add_widget(MDLabel(
        text=subtitle,
        font_style="Caption",
        theme_text_color="Custom",
        text_color=c("text3"),
        size_hint_y=0.45
    ))
    inner.add_widget(info)

    if on_delete:
        del_btn = MDFlatButton(
            text="x",
            font_size="16sp",
            theme_text_color="Custom",
            text_color=_c(t("error")),
            size_hint_x=None,
            width=dp(44)
        )
        del_btn.bind(on_release=on_delete)
        inner.add_widget(del_btn)

    row.add_widget(inner)
    return row


def _redraw_accent(widget, color_key):
    widget.canvas.clear()
    with widget.canvas:
        Color(*_c(t(color_key)))
        RoundedRectangle(
            pos=widget.pos,
            size=widget.size,
            radius=[2, 0, 0, 2]
        )


# ── Rank badge ────────────────────────────────────────────────────

def rank_badge(rank, size=dp(52)):
    color = rank_color(rank)
    card = MDCard(
        radius=R["md"],
        elevation=0,
        padding=[dp(4), dp(4)],
        size_hint=(None, None),
        size=(size, size),
        md_bg_color=_c(color + "22")
    )
    card.add_widget(MDLabel(
        text=rank,
        font_style="H6",
        theme_text_color="Custom",
        text_color=_c(color),
        halign="center",
        valign="middle",
        bold=True
    ))
    return card


# ── Primary button ────────────────────────────────────────────────

def primary_btn(text, color_key="accent",
                on_press=None, height=dp(52)):
    btn = MDRaisedButton(
        text=text,
        font_size="14sp",
        md_bg_color=_c(t(color_key)),
        size_hint_y=None,
        height=height,
        elevation=0
    )
    if on_press:
        btn.bind(on_release=on_press)
    return btn


# ── Ghost button ──────────────────────────────────────────────────

def ghost_btn(text, color_key="text2",
              on_press=None, height=dp(44)):
    btn = MDFlatButton(
        text=text,
        font_size="13sp",
        theme_text_color="Custom",
        text_color=_c(t(color_key)),
        size_hint_y=None,
        height=height
    )
    if on_press:
        btn.bind(on_release=on_press)
    return btn


# ── Info card ─────────────────────────────────────────────────────

def info_card(label, value, sub=None,
              color_key="accent", height=dp(72)):
    card = MDCard(
        orientation="vertical",
        radius=R["md"],
        elevation=0,
        padding=[dp(14), dp(12)],
        size_hint_y=None,
        height=height,
        md_bg_color=c("card")
    )
    card.add_widget(MDLabel(
        text=label,
        font_style="Overline",
        theme_text_color="Custom",
        text_color=c("text3"),
        size_hint_y=None,
        height=dp(18)
    ))
    card.add_widget(MDLabel(
        text=str(value),
        font_style="H5",
        theme_text_color="Custom",
        text_color=_c(t(color_key)),
        bold=True,
        size_hint_y=None,
        height=dp(36)
    ))
    if sub:
        card.add_widget(MDLabel(
            text=sub,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None,
            height=dp(16)
        ))
    return card


# ── Bottom navigation bar ─────────────────────────────────────────

class BottomNav(MDBoxLayout):
    """
    Persistent bottom navigation for top-level screens.
    5 tabs: Home, Stats, Spirit, Mind, Energy
    """

    TABS = [
        ("Home",   "navigation", "H"),
        ("Stats",  "dashboard",  "S"),
        ("Spirit", "spirit",     "Sp"),
        ("Mind",   "mind",       "M"),
        ("Energy", "energy",     "E"),
    ]

    def __init__(self, screen_manager,
                 active_screen="navigation", **kwargs):
        super().__init__(**kwargs)
        self.sm = screen_manager
        self.active = active_screen
        self.orientation = "horizontal"
        self.size_hint_y = None
        self.height = dp(60)
        self.md_bg_color = c("bg2")
        self.padding = [dp(4), dp(4)]
        self.spacing = dp(4)
        self._build()

    def _build(self):
        self.clear_widgets()
        for label, screen, icon in self.TABS:
            is_active = screen == self.active
            col = t("accent") if is_active else t("text3")
            btn = MDFlatButton(
                text=f"{icon}\n{label}",
                halign="center",
                font_size="10sp",
                theme_text_color="Custom",
                text_color=_c(col),
                size_hint_x=1/len(self.TABS)
            )
            sc = screen
            btn.bind(on_release=lambda x, s=sc: self._go(s))
            self.add_widget(btn)

    def _go(self, screen):
        self.active = screen
        self.sm.current = screen
        self._build()


# ── Theme toggle ──────────────────────────────────────────────────

class ThemeToggle(MDCard):
    def __init__(self, on_toggle=None, **kwargs):
        super().__init__(**kwargs)
        self.on_toggle_cb = on_toggle
        self.radius = [dp(16)]
        self.elevation = 0
        self.size_hint = (None, None)
        self.size = (dp(56), dp(28))
        self.md_bg_color = c("card2")
        self._lbl = MDLabel(
            halign="center",
            valign="middle",
            font_size="16sp"
        )
        self._update()
        self.add_widget(self._lbl)
        self.bind(on_release=self._toggle)

    def _update(self):
        from shared.theme import is_dark
        self._lbl.text = "D" if is_dark() else "L"
        self._lbl.color = c("text2")
        self.md_bg_color = c("card2")

    def _toggle(self, *args):
        from shared.theme import set_mode, is_dark
        set_mode("light" if is_dark() else "dark")
        self._update()
        if self.on_toggle_cb:
            self.on_toggle_cb()

