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


def check_subscription(device_id, db,
                        on_result=None):
    """
    Non-blocking subscription check.
    Runs in background thread.
    Calls on_result(tier) on main thread when done.
    """
    if not SYNC_ENABLED:
        if on_result:
            on_result(None)
        return

    def _fetch():
        try:
            import urllib.request
            import json

            url = (f"{SUPABASE_URL}/rest/v1/paid_users"
                   f"?device_id=eq.{device_id}"
                   f"&select=tier,expires_at"
                   f"&limit=1")

            req = urllib.request.Request(url)
            req.add_header(
                "apikey", SUPABASE_ANON_KEY)
            req.add_header(
                "Authorization",
                f"Bearer {SUPABASE_ANON_KEY}")
            req.add_header(
                "Content-Type", "application/json")

            with urllib.request.urlopen(
                    req, timeout=8) as resp:
                data = json.loads(
                    resp.read().decode())

            if data and len(data) > 0:
                tier = data[0].get("tier", "free")
                expires = data[0].get("expires_at")

                # Check expiry for pro monthly
                if expires:
                    from datetime import datetime
                    exp = datetime.fromisoformat(
                        expires.replace("Z", "+00:00"))
                    from datetime import timezone
                    now = datetime.now(timezone.utc)
                    if now > exp:
                        tier = "free"

                # Apply to local db
                def _apply(dt):
                    try:
                        db.execute(
                            """INSERT OR REPLACE INTO
                               app_settings
                               (key, value)
                               VALUES
                               ('subscription_tier',
                               ?)""",
                            (tier,))
                        if on_result:
                            on_result(tier)
                    except Exception:
                        if on_result:
                            on_result(None)
                Clock.schedule_once(_apply, 0)
            else:
                Clock.schedule_once(
                    lambda dt: on_result(None)
                    if on_result else None, 0)

        except Exception:
            # Network failure — keep local state
            Clock.schedule_once(
                lambda dt: on_result(None)
                if on_result else None, 0)

    thread = threading.Thread(
        target=_fetch, daemon=True)
    thread.start()


def register_device(device_id, user_name,
                    tier, payment_method,
                    amount, notes=""):
    """
    Called from your admin panel.
    Writes a new paid user to Supabase
    using the service role key.
    """
    if not SYNC_ENABLED:
        return False, "Supabase not configured"

    try:
        import urllib.request
        import urllib.error
        import json
        from datetime import datetime, timezone, timedelta

        # Calculate expiry for pro monthly
        expires_at = None
        if tier == "pro":
            expires_at = (
                datetime.now(timezone.utc) +
                timedelta(days=30)
            ).isoformat()

        payload = {
            "device_id":      device_id,
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
        url = f"{SUPABASE_URL}/rest/v1/paid_users"

        req = urllib.request.Request(
            url, data=data, method="POST")
        req.add_header(
            "apikey", SUPABASE_ANON_KEY)
        req.add_header(
            "Authorization",
            f"Bearer {SUPABASE_ANON_KEY}")
        req.add_header(
            "Content-Type", "application/json")
        req.add_header(
            "Prefer", "return=minimal")

        with urllib.request.urlopen(
                req, timeout=10) as resp:
            if resp.status in (200, 201):
                return True, "User activated"
            return False, f"Status {resp.status}"

    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "duplicate" in body.lower():
            # Already exists — update tier instead
            return _update_tier(
                device_id, tier, expires_at)
        return False, f"HTTP {e.code}: {body}"
    except Exception as ex:
        return False, str(ex)


def _update_tier(device_id, tier, expires_at=None):
    """Update existing user's tier."""
    try:
        import urllib.request
        import json

        payload = {"tier": tier}
        if expires_at:
            payload["expires_at"] = expires_at

        data = json.dumps(payload).encode()
        url = (f"{SUPABASE_URL}/rest/v1/paid_users"
               f"?device_id=eq.{device_id}")

        req = urllib.request.Request(
            url, data=data, method="PATCH")
        req.add_header(
            "apikey", SUPABASE_ANON_KEY)
        req.add_header(
            "Authorization",
            f"Bearer {SUPABASE_ANON_KEY}")
        req.add_header(
            "Content-Type", "application/json")
        req.add_header(
            "Prefer", "return=minimal")

        with urllib.request.urlopen(
                req, timeout=10):
            return True, "Tier updated"
    except Exception as ex:
        return False, str(ex)
