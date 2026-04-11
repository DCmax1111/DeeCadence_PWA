"""
User settings screen.
Shows device ID for subscription activation.
Allows name change, theme preference.
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
from shared.theme import c, t, hex_color, R
from shared.components import (
    top_nav, section_label, spacer
)
from core.device_id import get_device_id
from core.subscription import SubscriptionGate
from core.sync import check_subscription


def _c(h): return hex_color(h)

TIER_LABELS = {
    "free":    ("Free",    "text3"),
    "pioneer": ("Pioneer", "gold"),
    "pro":     ("Pro",     "accent"),
}

APP_VERSION = "0.1.0"
ADMIN_TAPS_REQUIRED = 5


class SettingsScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._version_taps = 0
        self._name_field = None

    def on_enter(self):
        self.md_bg_color = c("bg")
        self.clear_widgets()
        self._version_taps = 0
        self._build()

    def _build(self):
        app = App.get_running_app()
        gate = SubscriptionGate(app.db)
        device_id = get_device_id(app.db)
        tier = gate._tier
        tier_label, tier_color = TIER_LABELS.get(
            tier, ("Free", "text3"))

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "Settings", "accent"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(20), dp(20),
                     dp(20), dp(32)],
            spacing=dp(0),
            size_hint_y=None
        )
        body.bind(
            minimum_height=body.setter("height"))

        # ── Subscription status ───────────────────────────────────
        body.add_widget(
            section_label("SUBSCRIPTION",
                         top_space=False))
        body.add_widget(spacer(8))

        sub_card = MDCard(
            orientation="horizontal",
            radius=R["lg"], elevation=0,
            padding=[dp(18), dp(16)],
            size_hint_y=None, height=dp(72),
            md_bg_color=c("card"),
            spacing=dp(16)
        )
        sub_info = MDBoxLayout(
            orientation="vertical",
            size_hint_x=0.7
        )
        sub_info.add_widget(MDLabel(
            text=tier_label,
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(t(tier_color)),
            bold=True, size_hint_y=0.6
        ))
        sub_info.add_widget(MDLabel(
            text=("Lifetime access"
                  if tier == "pioneer"
                  else "Full access"
                  if tier == "pro"
                  else "4 modules · 14 days history"),
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=0.4
        ))
        sub_card.add_widget(sub_info)

        if tier == "free":
            upgrade_btn = MDFlatButton(
                text="Upgrade >",
                theme_text_color="Custom",
                text_color=_c(t("accent")),
                size_hint_x=0.3
            )
            upgrade_btn.bind(
                on_release=lambda x: setattr(
                    self.manager, "current",
                    "upgrade"))
            sub_card.add_widget(upgrade_btn)

        body.add_widget(sub_card)
        body.add_widget(spacer(8))

        # Refresh subscription button
        refresh_btn = MDFlatButton(
            text="Check subscription status",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(36)
        )
        refresh_btn.bind(
            on_release=lambda x:
                self._refresh_subscription(
                    device_id))
        body.add_widget(refresh_btn)
        body.add_widget(spacer(20))

        # ── Device ID ─────────────────────────────────────────────
        body.add_widget(
            section_label("YOUR DEVICE ID"))
        body.add_widget(spacer(8))
        body.add_widget(MDLabel(
            text="Share this with support to "
                 "activate your subscription.",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(28)
        ))
        body.add_widget(spacer(6))

        id_card = MDCard(
            orientation="horizontal",
            radius=R["md"], elevation=0,
            padding=[dp(14), dp(12)],
            size_hint_y=None, height=dp(52),
            md_bg_color=c("surface")
        )
        id_card.add_widget(MDLabel(
            text=device_id,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_x=0.8
        ))
        copy_btn = MDFlatButton(
            text="Copy",
            theme_text_color="Custom",
            text_color=_c(t("accent")),
            size_hint_x=0.2
        )
        copy_btn.bind(
            on_release=lambda x:
                self._copy_device_id(device_id))
        id_card.add_widget(copy_btn)
        body.add_widget(id_card)
        body.add_widget(spacer(24))

        # ── Account linking ───────────────────────────────────────────────
        body.add_widget(section_label("ACCOUNT LINK"))
        body.add_widget(spacer(8))
        body.add_widget(MDLabel(
            text="Link an account ID to access your "
                "subscription across multiple devices.",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(36)
        ))
        body.add_widget(spacer(6))

        current_account = get_account_id(app.db)
        body.add_widget(MDLabel(
            text=f"Current: {current_account[:20]}...",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(24)
        ))
        body.add_widget(spacer(6))

        self._account_field = MDTextField(
            hint_text="Enter account ID (e.g. your email)",
            mode="rectangle",
            size_hint_y=None, height=dp(52),
            line_color_normal=_c(t("border")),
            line_color_focus=_c(t("accent")),
            hint_text_color_normal=_c(t("text3")),
            text_color_normal=_c(t("text")),
            fill_color_normal=_c(t("surface")),
            radius=[dp(10)] * 4
        )
        body.add_widget(self._account_field)
        body.add_widget(spacer(8))

        link_btn = MDRaisedButton(
            text="Link account",
            md_bg_color=_c(t("accent")),
            size_hint_y=None, height=dp(52)
        )
        link_btn.bind(
            on_release=lambda x: self._link_account())
        body.add_widget(link_btn)
        body.add_widget(spacer(20))

        # ── Profile ───────────────────────────────────────────────
        body.add_widget(
            section_label("PROFILE"))
        body.add_widget(spacer(8))

        self._name_field = MDTextField(
            hint_text="Your name",
            mode="rectangle",
            text=getattr(app, 'user_name', ''),
            size_hint_y=None, height=dp(52),
            line_color_normal=_c(t("border")),
            line_color_focus=_c(t("accent")),
            hint_text_color_normal=_c(t("text3")),
            text_color_normal=_c(t("text")),
            fill_color_normal=_c(t("surface")),
            radius=[dp(10)] * 4
        )
        body.add_widget(self._name_field)
        body.add_widget(spacer(10))

        save_btn = MDRaisedButton(
            text="Save name",
            md_bg_color=_c(t("accent")),
            size_hint_y=None, height=dp(52)
        )
        save_btn.bind(
            on_release=lambda x: self._save_name())
        body.add_widget(save_btn)
        body.add_widget(spacer(32))

        # ── Version — tap 5x to open admin ───────────────────────
        version_lbl = MDLabel(
            text=f"Dee_Cistem v{APP_VERSION}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text4"),
            halign="center",
            size_hint_y=None, height=dp(32)
        )
        version_lbl.bind(
            on_touch_up=lambda w, t_:
                self._version_tap(w, t_))
        body.add_widget(version_lbl)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _refresh_subscription(self, device_id):
        app = App.get_running_app()

        def on_result(tier):
            if tier:
                gate = SubscriptionGate(app.db)
                gate.apply_upgrade(tier)
                self.on_enter()  # Rebuild screen

        check_subscription(
            device_id, app.db,
            on_result=on_result)

    def _copy_device_id(self, device_id):
        try:
            from kivy.core.clipboard import Clipboard
            Clipboard.copy(device_id)
        except Exception:
            pass

    def _save_name(self):
        name = self._name_field.text.strip()
        if not name:
            return
        app = App.get_running_app()
        app.user_name = name
        try:
            app.db.execute(
                """INSERT OR REPLACE INTO
                   app_settings (key, value)
                   VALUES ('user_name', ?)""",
                (name,))
        except Exception:
            pass

    def _version_tap(self, widget, touch):
        if widget.collide_point(*touch.pos):
            self._version_taps += 1
            if (self._version_taps >=
                    ADMIN_TAPS_REQUIRED):
                self._version_taps = 0
                self.manager.current = "admin"

    def _link_account(self):
        account_id = self._account_field.text.strip()
        if not account_id:
            return
        app = App.get_running_app()
        from core.device_id import set_account_id
        set_account_id(app.db, account_id)
        # Immediately check subscription for this account
        from core.sync import check_subscription

        def on_result(tier):
            if tier:
                from core.subscription import (
                    SubscriptionGate)
                gate = SubscriptionGate(app.db)
                gate.apply_upgrade(tier)
            self.on_enter()

        check_subscription(app.db, on_result=on_result)

