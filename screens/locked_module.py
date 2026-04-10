"""
Shown when a free-tier user taps a locked module.
Clean, non-aggressive paywall.
"""
from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from shared.theme import c, t, hex_color, R
from shared.components import top_nav, spacer
from core.subscription import MODULE_ACCESS


def _c(h): return hex_color(h)

MODULE_DESCRIPTIONS = {
    "knowledge": {
        "name":  "Knowledge",
        "color": "knowledge",
        "desc":  "Track your reading, vocabulary, "
                 "and skill practice. See how your "
                 "knowledge compounds week over week.",
        "hook":  "Unlock to start building your "
                 "knowledge stat.",
    },
    "dexterity": {
        "name":  "Dexterity",
        "color": "dexterity",
        "desc":  "Log drawing, design, writing, and "
                 "craft sessions. Includes VoxScope — "
                 "your personal vocal range analyzer.",
        "hook":  "Unlock to access VoxScope and "
                 "track your creative output.",
    },
    "voxscope": {
        "name":  "VoxScope",
        "color": "dexterity",
        "desc":  "Real-time vocal range analysis, "
                 "7 warmup exercises, XP system, "
                 "and comparison against 46 artists "
                 "including Dimash Kudaibergen.",
        "hook":  "Unlock with Pioneer or Pro.",
    },
}


class LockedModuleScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._module_key = "knowledge"

    def set_module(self, module_key):
        self._module_key = module_key
        self._built = False

    def on_enter(self):
        self.md_bg_color = c("bg")
        self.clear_widgets()
        self._build()

    def _build(self):
        info = MODULE_DESCRIPTIONS.get(
            self._module_key, {
                "name":  self._module_key.title(),
                "color": "accent",
                "desc":  "This module is available "
                         "on paid plans.",
                "hook":  "Upgrade to unlock.",
            })

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, info["name"],
                   info["color"]))

        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(28), dp(40)],
            spacing=dp(0)
        )

        # Lock icon (text-based)
        body.add_widget(MDLabel(
            text="[ LOCKED ]",
            font_style="H6",
            theme_text_color="Custom",
            text_color=c("text3"),
            halign="center",
            size_hint_y=None, height=dp(40)
        ))
        body.add_widget(spacer(24))

        body.add_widget(MDLabel(
            text=info["name"],
            font_style="H4",
            theme_text_color="Custom",
            text_color=_c(t(info["color"])),
            bold=True,
            halign="center",
            size_hint_y=None, height=dp(52)
        ))
        body.add_widget(MDLabel(
            text=info["desc"],
            font_style="Body1",
            theme_text_color="Custom",
            text_color=c("text2"),
            halign="center",
            size_hint_y=None, height=dp(72)
        ))
        body.add_widget(spacer(32))

        body.add_widget(MDLabel(
            text=info["hook"],
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text3"),
            halign="center",
            size_hint_y=None, height=dp(32)
        ))
        body.add_widget(spacer(20))

        upgrade_btn = MDRaisedButton(
            text="See upgrade options",
            md_bg_color=_c(t("accent")),
            size_hint_y=None, height=dp(52),
            font_size="15sp"
        )
        upgrade_btn.bind(
            on_release=lambda x: setattr(
                self.manager, "current", "upgrade"))
        body.add_widget(upgrade_btn)
        body.add_widget(spacer(12))

        back_btn = MDFlatButton(
            text="Go back",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(40)
        )
        back_btn.bind(
            on_release=lambda x: setattr(
                self.manager, "current", "navigation"))
        body.add_widget(back_btn)

        root.add_widget(body)
        self.add_widget(root)
