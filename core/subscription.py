"""
Dee_Cistem Subscription Gate System
------------------------------------
SUBSCRIPTIONS_ACTIVE = False  → everyone gets full access
SUBSCRIPTIONS_ACTIVE = True   → tier gates engage

Flip the switch in app_settings:
    INSERT OR REPLACE INTO app_settings
    VALUES ('subscriptions_active', '1')

Tiers:
    free     — 4 modules, 14 days history, basic stats
    pioneer  — lifetime, full access, NGN 5,000 one-time
    pro      — monthly/annual, full access + export + analytics
"""

# ── Module access map ─────────────────────────────────────────────

MODULE_ACCESS = {
    "free": {
        "financial":  True,
        "spirit":     True,
        "mind":       True,
        "energy":     True,
        "knowledge":  False,
        "dexterity":  False,
        "deecadence": True,   # under mind — free
        "voxscope":   False,  # under dexterity — locked
    },
    "pioneer": {
        "financial":  True,
        "spirit":     True,
        "mind":       True,
        "energy":     True,
        "knowledge":  True,
        "dexterity":  True,
        "deecadence": True,
        "voxscope":   True,
    },
    "pro": {
        "financial":  True,
        "spirit":     True,
        "mind":       True,
        "energy":     True,
        "knowledge":  True,
        "dexterity":  True,
        "deecadence": True,
        "voxscope":   True,
    },
}

HISTORY_DAYS = {
    "free":    14,
    "pioneer": None,   # unlimited
    "pro":     None,   # unlimited, view defaults to 30
}

FEATURE_ACCESS = {
    "free": {
        "ai_insights":        False,
        "export_pdf":         False,
        "advanced_analytics": False,
        "full_voxscope":      False,
        "expand_history":     False,
    },
    "pioneer": {
        "ai_insights":        True,
        "export_pdf":         True,
        "advanced_analytics": True,
        "full_voxscope":      True,
        "expand_history":     True,
    },
    "pro": {
        "ai_insights":        True,
        "export_pdf":         True,
        "advanced_analytics": True,
        "full_voxscope":      True,
        "expand_history":     True,
    },
}

# Pioneer slots
PIONEER_SLOTS_TOTAL = 50

# Pricing — NGN
PRICING = {
    "pioneer": {
        "label":    "Pioneer",
        "amount":   5000,
        "currency": "NGN",
        "type":     "one_time",
        "desc":     "Lifetime access · First 50 only",
    },
    "pro_monthly": {
        "label":    "Pro Monthly",
        "amount":   1500,
        "currency": "NGN",
        "type":     "recurring",
        "interval": "month",
        "desc":     "Full access · Cancel anytime",
    },
    "pro_annual": {
        "label":    "Pro Annual",
        "amount":   15000,
        "currency": "NGN",
        "type":     "recurring",
        "interval": "year",
        "desc":     "Full access · 2 months free",
    },
}


class SubscriptionGate:
    """
    Central access control.
    All feature checks go through here.
    """

    def __init__(self, db):
        self.db = db
        self._cache = {}
        self._load()

    def _load(self):
        """Load subscription state from db."""
        try:
            rows = self.db.fetchall(
                "SELECT key, value FROM app_settings")
            settings = {r["key"]: r["value"]
                        for r in rows}
            self._active = (
                settings.get(
                    "subscriptions_active", "0") == "1")
            self._tier = settings.get(
                "subscription_tier", "free")
            self._pioneer_count = int(
                settings.get("pioneer_count", "0"))
        except Exception:
            self._active = False
            self._tier = "free"
            self._pioneer_count = 0

    def refresh(self):
        self._load()

    # ── Master switch ─────────────────────────────────────────────

    @property
    def subscriptions_active(self):
        return self._active

    @property
    def tier(self):
        """
        If subscriptions are off — everyone is 'pro'.
        If subscriptions are on — return actual tier.
        """
        if not self._active:
            return "pro"
        return self._tier

    # ── Access checks ─────────────────────────────────────────────

    def can_access_module(self, module_key):
        tier = self.tier
        access = MODULE_ACCESS.get(tier, {})
        return access.get(module_key, False)

    def can_access_feature(self, feature_key):
        tier = self.tier
        features = FEATURE_ACCESS.get(tier, {})
        return features.get(feature_key, False)

    def history_days(self):
        return HISTORY_DAYS.get(self.tier, 14)

    def pioneer_slots_remaining(self):
        return max(0,
                   PIONEER_SLOTS_TOTAL -
                   self._pioneer_count)

    def is_pioneer_available(self):
        return (self.pioneer_slots_remaining() > 0 and
                self._active)

    # ── Upgrade ───────────────────────────────────────────────────

    def apply_upgrade(self, new_tier):
        """
        Called after successful payment verification.
        Writes new tier to db.
        """
        valid_tiers = ["free", "pioneer", "pro"]
        if new_tier not in valid_tiers:
            return False

        # Prevent downgrade via this method
        tier_rank = {"free": 0, "pioneer": 2, "pro": 1}
        current_rank = tier_rank.get(self._tier, 0)
        new_rank = tier_rank.get(new_tier, 0)
        if new_rank <= current_rank and new_tier != "free":
            return False

        try:
            self.db.execute(
                """INSERT OR REPLACE INTO
                   app_settings (key, value)
                   VALUES ('subscription_tier', ?)""",
                (new_tier,))
            if new_tier == "pioneer":
                self.db.execute(
                    """INSERT OR REPLACE INTO
                       app_settings (key, value)
                       VALUES ('pioneer_count', ?)""",
                    (str(self._pioneer_count + 1),))
            self._load()
            return True
        except Exception:
            return False

    # ── Admin: toggle subscriptions ───────────────────────────────

    def set_subscriptions_active(self, active: bool):
        """
        Master switch.
        active=False → everyone gets full access (testing mode)
        active=True  → tier gates engage
        """
        val = "1" if active else "0"
        try:
            self.db.execute(
                """INSERT OR REPLACE INTO
                   app_settings (key, value)
                   VALUES ('subscriptions_active', ?)""",
                (val,))
            self._load()
            return True
        except Exception:
            return False
