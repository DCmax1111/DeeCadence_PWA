"""
Dee_Cistem Supabase Sync
-------------------------
Checks if this device has a paid subscription
by looking up its device_id in Supabase.
This runs on app launch and after returning
from the upgrade screen.
"""

import threading
from kivy.clock import Clock
from core.config import SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_ENABLED
from core.device_id import get_account_id


def check_subscription(db, on_result=None):
    """Check subscription by account_id."""
    from kivy.app import App
    account_id = get_account_id(db)

    if not SYNC_ENABLED:
        if on_result:
            on_result(None)
        return

    def _fetch():
        try:
            import urllib.request
            import json

            url = (f"{SUPABASE_URL}/rest/v1/paid_users"
                   f"?account_id=eq.{account_id}"
                   f"&select=tier,expires_at"
                   f"&limit=1")

            req = urllib.request.Request(url)
            req.add_header("apikey", SUPABASE_ANON_KEY)
            req.add_header(
                "Authorization",
                f"Bearer {SUPABASE_ANON_KEY}")

            with urllib.request.urlopen(
                    req, timeout=8) as resp:
                data = json.loads(
                    resp.read().decode())

            if data:
                tier = data[0].get("tier", "free")
                expires = data[0].get("expires_at")

                if expires:
                    from datetime import (
                        datetime, timezone)
                    exp = datetime.fromisoformat(
                        expires.replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    if now > exp:
                        tier = "free"

                from kivy.clock import Clock

                def _apply(dt):
                    try:
                        db.execute(
                            """INSERT OR REPLACE INTO
                               app_settings (key, value)
                               VALUES
                               ('subscription_tier',?)""",
                            (tier,))
                        if on_result:
                            on_result(tier)
                    except Exception:
                        if on_result:
                            on_result(None)
                Clock.schedule_once(_apply, 0)
            else:
                from kivy.clock import Clock
                Clock.schedule_once(
                    lambda dt: on_result(None)
                    if on_result else None, 0)

        except Exception:
            from kivy.clock import Clock
            Clock.schedule_once(
                lambda dt: on_result(None)
                if on_result else None, 0)

    import threading
    threading.Thread(
        target=_fetch, daemon=True).start()


def register_device(account_id, user_name,
                    tier, payment_method,
                    amount, notes=""):
    """Register or update a paid user by account_id."""
    if not SYNC_ENABLED:
        return False, "Supabase not configured"

    try:
        import urllib.request
        import json
        from datetime import (
            datetime, timezone, timedelta)

        expires_at = None
        if tier == "pro":
            expires_at = (
                datetime.now(timezone.utc) +
                timedelta(days=30)
            ).isoformat()

        payload = {
            "account_id":     account_id,
            "user_name":      user_name,
            "tier":           tier,
            "payment_method": payment_method,
            "amount_paid":    amount,
            "currency":       "NGN",
            "notes":          notes,
        }
        if expires_at:
            payload["expires_at"] = expires_at

        data = json.dumps(payload).encode()
        url = (f"{SUPABASE_URL}/rest/v1/paid_users"
               f"?on_conflict=account_id")

        req = urllib.request.Request(
            url, data=data, method="POST")
        req.add_header("apikey", SUPABASE_ANON_KEY)
        req.add_header(
            "Authorization",
            f"Bearer {SUPABASE_ANON_KEY}")
        req.add_header(
            "Content-Type", "application/json")
        req.add_header(
            "Prefer",
            "resolution=merge-duplicates,"
            "return=minimal")

        with urllib.request.urlopen(
                req, timeout=10) as resp:
            if resp.status in (200, 201):
                return True, "User activated"
            return False, f"Status {resp.status}"

    except Exception as ex:
        return False, str(ex)
