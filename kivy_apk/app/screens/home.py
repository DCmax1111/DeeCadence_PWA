from kivy.metrics import dp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.card import MDCard
from kivymd.uix.label import MDLabel
from kivymd.uix.screen import MDScreen

from app.core.subscription import SubscriptionState


MODULES = [
    ("Financial", "Income, expenses, and cashflow", "financial"),
    ("Spirit", "Prayer, Bible, reflection, and leadership", "spirit"),
    ("Mind", "Focus, mood, and DeeCadence", "mind"),
    ("Energy", "Sleep, water, exercise, and body care", "energy"),
    ("Knowledge", "Reading, vocabulary, and practice", "knowledge"),
    ("Dexterity", "Creative skill, craft, and VoxScope", "dexterity"),
]


class HomeScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.subscriptions = SubscriptionState(active=False)

    def on_pre_enter(self):
        if not self.children:
            self._build()

    def _build(self):
        root = MDBoxLayout(
            orientation="vertical",
            padding=[dp(18), dp(18), dp(18), dp(18)],
            spacing=dp(12),
            md_bg_color=(0.047, 0.051, 0.078, 1),
        )

        root.add_widget(MDLabel(
            text="DeeCee",
            font_style="H5",
            theme_text_color="Custom",
            text_color=(0.31, 0.56, 0.97, 1),
            size_hint_y=None,
            height=dp(36),
        ))
        root.add_widget(MDLabel(
            text="Today",
            font_style="H4",
            theme_text_color="Custom",
            text_color=(0.94, 0.95, 1, 1),
            size_hint_y=None,
            height=dp(52),
        ))

        for name, desc, key in MODULES:
            locked = not self.subscriptions.can_access(key)
            root.add_widget(self._module_card(name, desc, locked))

        self.add_widget(root)

    def _module_card(self, name, desc, locked):
        card = MDCard(
            orientation="vertical",
            padding=[dp(14), dp(12), dp(14), dp(12)],
            radius=[dp(8)],
            elevation=0,
            size_hint_y=None,
            height=dp(76),
            md_bg_color=(0.11, 0.13, 0.19, 1),
        )
        card.add_widget(MDLabel(
            text=f"{name}{' - Locked' if locked else ''}",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=(0.94, 0.95, 1, 1),
            bold=True,
        ))
        card.add_widget(MDLabel(
            text=desc,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=(0.61, 0.64, 0.77, 1),
        ))
        return card
