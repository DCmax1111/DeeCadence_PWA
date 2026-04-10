"""
Upgrade screen.
Shows tier comparison, pioneer slot counter,
and Cleva payment links.
"""
from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from kivy.utils import platform
from kivy.graphics import Color, RoundedRectangle, Line
from shared.theme import c, t, hex_color, R
from shared.components import (
    top_nav, section_label, spacer
)
from core.subscription import PRICING, SubscriptionGate


def _c(h): return hex_color(h)

# ── Replace with your actual Cleva payment links ──────────────────
# When subscriptions_active = False these are never shown
CLEVA_LINKS = {
    "pioneer":    "https://pay.usecleva.com/YOUR_PIONEER_LINK",
    "pro_monthly":"https://pay.usecleva.com/YOUR_PRO_MONTHLY_LINK",
    "pro_annual": "https://pay.usecleva.com/YOUR_PRO_ANNUAL_LINK",
}

TIER_FEATURES = {
    "Free": [
        "Financial, Spirit, Mind, Energy modules",
        "14 days history",
        "Basic stat tracking",
        "Core logging — all four modules",
        "Knowledge + Dexterity locked",
        "VoxScope locked",
    ],
    "Pioneer": [
        "All 6 modules unlocked",
        "Unlimited history",
        "Full VoxScope access",
        "Advanced analytics",
        "Export to PDF",
        "AI insights layer",
        "Lifetime access — pay once",
        "Pioneer badge in app",
    ],
    "Pro": [
        "All 6 modules unlocked",
        "Unlimited history (30-day view, expandable)",
        "Full VoxScope access",
        "Advanced analytics",
        "Export to PDF",
        "AI insights layer",
        "Monthly or annual billing",
    ],
}


class UpgradeScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._built = False

    def on_enter(self):
        self.md_bg_color = c("bg")
        if not self._built:
            self._build()
            self._built = True

    def _build(self):
        app = App.get_running_app()
        gate = SubscriptionGate(app.db)
        current_tier = gate._tier
        slots = gate.pioneer_slots_remaining()

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "Upgrade", "accent"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(20), dp(20),
                     dp(20), dp(32)],
            spacing=dp(0),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Hero ──────────────────────────────────────────────────
        body.add_widget(MDLabel(
            text="Unlock the\nfull system.",
            font_style="H4",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=None,
            height=dp(96)
        ))
        body.add_widget(MDLabel(
            text=f"You're currently on the "
                 f"{'Free' if current_tier == 'free' else current_tier.title()} "
                 f"plan.",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=c("text2"),
            size_hint_y=None,
            height=dp(28)
        ))
        body.add_widget(spacer(24))

        # ── Pioneer card ──────────────────────────────────────────
        if slots > 0:
            pioneer_card = self._tier_card(
                "Pioneer",
                f"₦{PRICING['pioneer']['amount']:,}",
                "one-time · lifetime access",
                TIER_FEATURES["Pioneer"],
                "gold",
                f"{slots} of 50 spots remaining",
                "pioneer",
                is_featured=True
            )
            body.add_widget(pioneer_card)
            body.add_widget(spacer(12))

        # ── Pro card ──────────────────────────────────────────────
        pro_card = self._tier_card(
            "Pro",
            f"₦{PRICING['pro_monthly']['amount']:,}",
            "/month  ·  or ₦15,000/year (2 months free)",
            TIER_FEATURES["Pro"],
            "accent",
            None,
            "pro_monthly",
            is_featured=False
        )
        body.add_widget(pro_card)
        body.add_widget(spacer(12))

        # ── Free tier comparison ──────────────────────────────────
        body.add_widget(
            section_label("FREE TIER INCLUDES"))
        body.add_widget(spacer(8))
        for feat in TIER_FEATURES["Free"]:
            locked = feat.endswith("locked")
            body.add_widget(self._feature_row(
                feat,
                "text3" if locked else "text2",
                locked=locked
            ))
            body.add_widget(spacer(4))

        body.add_widget(spacer(24))

        # ── Already subscribed ────────────────────────────────────
        if current_tier != "free":
            body.add_widget(MDLabel(
                text=f"You have {current_tier.title()} access. "
                     f"Thank you for supporting "
                     f"Dee_Cistem.",
                font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(t("financial")),
                halign="center",
                size_hint_y=None,
                height=dp(48)
            ))

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _tier_card(self, name, price, price_sub,
                   features, color_key, badge_text,
                   plan_key, is_featured=False):
        card = MDCard(
            orientation="vertical",
            radius=R["lg"],
            elevation=0,
            padding=[dp(20), dp(18)],
            size_hint_y=None,
            md_bg_color=(
                _c(t(color_key) + "15")
                if is_featured else c("card"))
        )

        # Header row
        header = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(32)
        )
        header.add_widget(MDLabel(
            text=name,
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(t(color_key)),
            bold=True
        ))
        if badge_text:
            badge = MDCard(
                radius=[12],
                elevation=0,
                padding=[dp(8), dp(4)],
                size_hint=(None, None),
                size=(None, dp(24)),
                md_bg_color=_c(t(color_key) + "22")
            )
            badge.add_widget(MDLabel(
                text=badge_text,
                font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(t(color_key)),
                size_hint_x=None,
                width=dp(160)
            ))
            header.add_widget(badge)
        card.add_widget(header)
        card.add_widget(spacer(8))

        # Price
        card.add_widget(MDLabel(
            text=price,
            font_style="H4",
            theme_text_color="Custom",
            text_color=c("text"),
            bold=True,
            size_hint_y=None,
            height=dp(48)
        ))
        card.add_widget(MDLabel(
            text=price_sub,
            font_style="Caption",
            theme_text_color="Custom",
            text_color=c("text3"),
            size_hint_y=None,
            height=dp(20)
        ))
        card.add_widget(spacer(12))

        # Features
        for feat in features:
            card.add_widget(
                self._feature_row(feat, color_key))
            card.add_widget(spacer(4))

        card.add_widget(spacer(16))

        # CTA button
        btn = MDRaisedButton(
            text=f"Get {name}",
            md_bg_color=_c(t(color_key)),
            size_hint_y=None,
            height=dp(52),
            font_size="15sp"
        )
        pk = plan_key
        btn.bind(
            on_release=lambda x, p=pk:
                self._open_payment(p))
        card.add_widget(btn)

        # Dynamic height
        base_h = 280
        card.height = dp(base_h + len(features) * 26)

        return card

    def _feature_row(self, text, color_key,
                     locked=False):
        row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(24),
            spacing=dp(8)
        )
        row.add_widget(MDLabel(
            text="x" if locked else "v",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=(_c(t("error"))
                        if locked
                        else _c(t(color_key))),
            size_hint_x=None,
            width=dp(20)
        ))
        row.add_widget(MDLabel(
            text=text,
            font_style="Body2",
            theme_text_color="Custom",
            text_color=(c("text3")
                        if locked else c("text2"))
        ))
        return row

    def _open_payment(self, plan_key):
        """Open Cleva payment link in browser."""
        link = CLEVA_LINKS.get(plan_key)
        if not link or "YOUR_" in link:
            # Subscriptions not configured yet
            self._show_coming_soon()
            return
        try:
            if platform == "android":
                from android.permissions import (
                    request_permissions, Permission)
                from jnius import autoclass
                Intent = autoclass(
                    'android.content.Intent')
                Uri = autoclass('android.net.Uri')
                PythonActivity = autoclass(
                    'org.kivy.android.PythonActivity')
                intent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(link))
                PythonActivity.mActivity\
                    .startActivity(intent)
            else:
                import webbrowser
                webbrowser.open(link)
        except Exception:
            import webbrowser
            webbrowser.open(link)

    def _show_coming_soon(self):
        """Shown when Cleva links aren't configured yet."""
        from kivymd.uix.dialog import MDDialog
        from kivymd.uix.button import MDFlatButton
        dialog = MDDialog(
            title="Coming Soon",
            text="Payment will be available in the "
                 "next update. Stay tuned.",
            buttons=[
                MDFlatButton(
                    text="OK",
                    on_release=lambda x: dialog.dismiss()
                )
            ]
        )
        dialog.open()
