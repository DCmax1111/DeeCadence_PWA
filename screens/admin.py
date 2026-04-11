"""
Dee_Cistem Admin Panel
----------------------
Access: tap the version number 5 times on the
navigation screen header (easter egg trigger).
Hidden from regular users entirely.

Used to:
- Activate paid users by device ID
- See pioneer slot count
- Toggle subscription master switch
- View all registered paid users
"""
from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.card import MDCard
from kivymd.uix.dialog import MDDialog
from kivymd.uix.menu import MDDropdownMenu
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from shared.theme import c, t, hex_color, R
from shared.components import (
    top_nav, section_label, spacer,
    input_field, log_row
)
from core.subscription import SubscriptionGate
from core.sync import register_device, SYNC_ENABLED
from core.device_id import get_device_id


def _c(h): return hex_color(h)


class AdminScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._dialog = None
        self._selected_tier = "pioneer"
        self._tier_menu = None

    def on_enter(self):
        self.md_bg_color = c("bg")
        self.clear_widgets()
        self._build()

    def _build(self):
        app = App.get_running_app()
        gate = SubscriptionGate(app.db)
        device_id = get_device_id(app.db)

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "Admin Panel", "error"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(20), dp(16),
                     dp(20), dp(32)],
            spacing=dp(0),
            size_hint_y=None
        )
        body.bind(
            minimum_height=body.setter("height"))

        # ── Status ────────────────────────────────────────────────
        body.add_widget(
            section_label("SYSTEM STATUS",
                         top_space=False))
        body.add_widget(spacer(8))

        status_card = MDCard(
            orientation="vertical",
            radius=R["md"], elevation=0,
            padding=[dp(16), dp(14)],
            size_hint_y=None, height=dp(120),
            md_bg_color=c("card")
        )
        sub_active = gate.subscriptions_active
        status_card.add_widget(MDLabel(
            text=("Subscriptions: ACTIVE"
                  if sub_active
                  else "Subscriptions: OFF (testing mode)"),
            font_style="Body1",
            theme_text_color="Custom",
            text_color=(_c(t("financial"))
                        if sub_active
                        else _c(t("warning"))),
            bold=True,
            size_hint_y=None, height=dp(28)
        ))
        status_card.add_widget(MDLabel(
            text=f"Current tier: {gate._tier}",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None, height=dp(24)
        ))
        status_card.add_widget(MDLabel(
            text=f"Pioneer slots: "
                 f"{gate.pioneer_slots_remaining()}"
                 f" remaining",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None, height=dp(24)
        ))
        status_card.add_widget(MDLabel(
            text=f"Supabase: "
                 f"{'Connected' if SYNC_ENABLED else 'Not configured'}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=(c("text3")),
            size_hint_y=None, height=dp(20)
        ))
        body.add_widget(status_card)
        body.add_widget(spacer(8))

        # ── Device ID ─────────────────────────────────────────────
        body.add_widget(
            section_label("THIS DEVICE"))
        body.add_widget(spacer(8))
        body.add_widget(MDLabel(
            text=device_id,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(24)
        ))
        body.add_widget(spacer(16))

        # ── Toggle subscription switch ────────────────────────────
        body.add_widget(
            section_label("MASTER SWITCH"))
        body.add_widget(spacer(8))

        toggle_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(52)
        )
        on_btn = MDRaisedButton(
            text="Turn ON",
            md_bg_color=_c(t("financial")),
            size_hint_x=0.5
        )
        on_btn.bind(
            on_release=lambda x:
                self._toggle_subs(True))
        off_btn = MDRaisedButton(
            text="Turn OFF",
            md_bg_color=_c(t("error")),
            size_hint_x=0.5
        )
        off_btn.bind(
            on_release=lambda x:
                self._toggle_subs(False))
        toggle_row.add_widget(on_btn)
        toggle_row.add_widget(off_btn)
        body.add_widget(toggle_row)
        body.add_widget(spacer(24))

        # ── Activate user ─────────────────────────────────────────
        body.add_widget(
            section_label("ACTIVATE PAID USER"))
        body.add_widget(spacer(8))

        body.add_widget(MDLabel(
            text="Enter the device ID from the "
                 "user's app (Settings screen).",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None, height=dp(28)
        ))
        body.add_widget(spacer(8))

        self._device_id_field = MDTextField(
            hint_text="User device ID (UUID)",
            mode="rectangle",
            size_hint_y=None, height=dp(52),
            line_color_normal=_c(t("border")),
            line_color_focus=_c(t("accent")),
            hint_text_color_normal=_c(t("text3")),
            text_color_normal=_c(t("text")),
            fill_color_normal=_c(t("surface")),
            radius=[dp(10)] * 4
        )
        body.add_widget(self._device_id_field)
        body.add_widget(spacer(8))

        self._username_field = MDTextField(
            hint_text="User name (optional)",
            mode="rectangle",
            size_hint_y=None, height=dp(52),
            line_color_normal=_c(t("border")),
            line_color_focus=_c(t("accent")),
            hint_text_color_normal=_c(t("text3")),
            text_color_normal=_c(t("text")),
            fill_color_normal=_c(t("surface")),
            radius=[dp(10)] * 4
        )
        body.add_widget(self._username_field)
        body.add_widget(spacer(8))

        self._amount_field = MDTextField(
            hint_text="Amount paid (NGN)",
            mode="rectangle",
            input_filter="int",
            size_hint_y=None, height=dp(52),
            line_color_normal=_c(t("border")),
            line_color_focus=_c(t("accent")),
            hint_text_color_normal=_c(t("text3")),
            text_color_normal=_c(t("text")),
            fill_color_normal=_c(t("surface")),
            radius=[dp(10)] * 4
        )
        body.add_widget(self._amount_field)
        body.add_widget(spacer(8))

        # Tier selector
        self._tier_btn = MDRaisedButton(
            text=f"Tier: {self._selected_tier.title()}",
            md_bg_color=c("card"),
            size_hint_y=None, height=dp(52)
        )
        tier_items = [
            {
                "text": tier.title(),
                "viewclass": "OneLineListItem",
                "on_release": lambda x=tier:
                    self._set_tier(x)
            }
            for tier in ["pioneer", "pro", "free"]
        ]
        self._tier_menu = MDDropdownMenu(
            caller=self._tier_btn,
            items=tier_items,
            width_mult=3
        )
        self._tier_btn.bind(
            on_release=lambda x:
                self._tier_menu.open())
        body.add_widget(self._tier_btn)
        body.add_widget(spacer(8))

        self._notes_field = MDTextField(
            hint_text="Notes (e.g. payment ref)",
            mode="rectangle",
            size_hint_y=None, height=dp(52),
            line_color_normal=_c(t("border")),
            line_color_focus=_c(t("accent")),
            hint_text_color_normal=_c(t("text3")),
            text_color_normal=_c(t("text")),
            fill_color_normal=_c(t("surface")),
            radius=[dp(10)] * 4
        )
        body.add_widget(self._notes_field)
        body.add_widget(spacer(12))

        activate_btn = MDRaisedButton(
            text="ACTIVATE USER",
            md_bg_color=_c(t("accent")),
            size_hint_y=None, height=dp(52),
            font_size="15sp"
        )
        activate_btn.bind(
            on_release=lambda x:
                self._activate_user())
        body.add_widget(activate_btn)

        # ── Quick activate this device ────────────────────────────
        body.add_widget(spacer(24))
        body.add_widget(
            section_label("QUICK ACTIVATE THIS DEVICE"))
        body.add_widget(spacer(8))

        quick_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(52)
        )
        for tier, color in [
            ("pioneer", "gold"),
            ("pro",     "accent"),
            ("free",    "error"),
        ]:
            btn = MDRaisedButton(
                text=tier.title(),
                md_bg_color=_c(t(color)),
                size_hint_x=1/3
            )
            btn.bind(
                on_release=lambda x, tr=tier:
                    self._quick_activate(tr))
            quick_row.add_widget(btn)
        body.add_widget(quick_row)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _set_tier(self, tier):
        self._selected_tier = tier
        self._tier_btn.text = f"Tier: {tier.title()}"
        self._tier_menu.dismiss()

    def _toggle_subs(self, active):
        app = App.get_running_app()
        gate = SubscriptionGate(app.db)
        gate.set_subscriptions_active(active)
        status = "ON" if active else "OFF"
        self._show_dialog(
            "Done",
            f"Subscriptions are now {status}.")

    def _activate_user(self):
        device_id = self._device_id_field.text.strip()
        username = self._username_field.text.strip()
        amount = self._amount_field.text.strip()
        notes = self._notes_field.text.strip()
        tier = self._selected_tier

        if not device_id:
            self._show_dialog(
                "Error", "Device ID is required.")
            return

        if not amount:
            amount = "0"

        # First activate locally if same device
        app = App.get_running_app()
        my_id = get_device_id(app.db)
        if device_id == my_id:
            gate = SubscriptionGate(app.db)
            gate.apply_upgrade(tier)

        # Then push to Supabase
        if SYNC_ENABLED:
            ok, msg = register_device(
                device_id=device_id,
                user_name=username or "User",
                tier=tier,
                payment_method="bank_transfer",
                amount=int(amount),
                notes=notes
            )
            if ok:
                self._show_dialog(
                    "Activated",
                    f"{username or device_id[:8]} "
                    f"activated as {tier.title()}. "
                    f"They'll see the upgrade on "
                    f"next app launch.")
                self._clear_fields()
            else:
                self._show_dialog("Error", msg)
        else:
            self._show_dialog(
                "Activated Locally",
                f"Supabase not configured — "
                f"activated on this device only.")
            self._clear_fields()

    def _quick_activate(self, tier):
        app = App.get_running_app()
        gate = SubscriptionGate(app.db)
        ok = gate.apply_upgrade(tier)
        if ok:
            self._show_dialog(
                "Done",
                f"This device is now on "
                f"{tier.title()} tier.")
        else:
            self._show_dialog(
                "Note",
                f"Already on {gate._tier} — "
                f"no downgrade applied.")

    def _clear_fields(self):
        self._device_id_field.text = ""
        self._username_field.text = ""
        self._amount_field.text = ""
        self._notes_field.text = ""
        self._notes_field.text = ""

    def _show_dialog(self, title, text):
        if self._dialog:
            self._dialog.dismiss()
        self._dialog = MDDialog(
            title=title,
            text=text,
            buttons=[MDFlatButton(
                text="OK",
                on_release=lambda x:
                    self._dialog.dismiss()
            )]
        )
        self._dialog.open()

