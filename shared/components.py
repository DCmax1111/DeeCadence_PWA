from kivymd.uix.card import MDCard
from kivymd.uix.label import MDLabel
from kivymd.uix.boxlayout import MDBoxLayout
from kivy.graphics import Color, RoundedRectangle
from shared.theme import PANEL, BORDER, ACCENT, TEXT, TEXT_DIM

class SystemCard(MDCard):
    """Base card with THE SYSTEM dark aesthetic."""
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = self._hex(PANEL)
        self.radius = [8]
        self.elevation = 0
        self.padding = "16dp"
        self.spacing = "8dp"

    def _hex(self, h):
        h = h.lstrip('#')
        return [int(h[i:i+2], 16)/255 for i in (0,2,4)] + [1]


class StatBar(MDBoxLayout):
    """Horizontal stat progress bar."""
    def __init__(self, stat_name, value, color, **kwargs):
        super().__init__(**kwargs)
        self.orientation = "vertical"
        self.spacing = "4dp"
        self.size_hint_y = None
        self.height = "40dp"

        name_row = MDBoxLayout(orientation="horizontal")
        name_row.add_widget(MDLabel(
            text=stat_name,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=self._hex(TEXT),
            size_hint_x=0.6
        ))
        name_row.add_widget(MDLabel(
            text=f"{int(value)}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=self._hex(color),
            halign="right",
            size_hint_x=0.4
        ))
        self.add_widget(name_row)

    def _hex(self, h):
        h = h.lstrip('#')
        return [int(h[i:i+2], 16)/255 for i in (0,2,4)] + [1]

def hex_color(h):
    h = h.lstrip('#')
    return [int(h[i:i+2], 16)/255 for i in (0,2,4)] + [1]

def top_nav(screen_ref, title, color, back_screen="navigation"):
    """Reusable top navigation bar with back button top-left."""
    from kivymd.uix.boxlayout import MDBoxLayout
    from kivymd.uix.label import MDLabel
    from kivymd.uix.button import MDFlatButton
    from kivy.metrics import dp

    nav = MDBoxLayout(
        orientation="horizontal",
        size_hint_y=None,
        height=dp(56),
        padding=[dp(4), 0],
        spacing=dp(4),
        md_bg_color=hex_color("#080d1a")
    )
    back = MDFlatButton(
        text="←  BACK",
        theme_text_color="Custom",
        text_color=hex_color("#4a6080"),
        size_hint_x=None,
        width=dp(90)
    )
    back.bind(on_release=lambda x: setattr(
        screen_ref.manager, "current", back_screen))
    nav.add_widget(back)
    nav.add_widget(MDLabel(
        text=title,
        font_style="H6",
        theme_text_color="Custom",
        text_color=hex_color(color),
        bold=True
    ))
    return nav
