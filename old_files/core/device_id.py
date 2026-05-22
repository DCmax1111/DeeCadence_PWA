"""
Identity system.
Primary: account_id (email or username) — works across devices
Fallback: device_id (UUID) — works offline
"""
import uuid


def get_device_id(db) -> str:
    """Persistent device-level ID."""
    try:
        row = db.fetchone(
            "SELECT value FROM app_settings "
            "WHERE key='device_id'")
        if row and row["value"]:
            return row["value"]
    except Exception:
        pass
    device_id = str(uuid.uuid4())
    try:
        db.execute(
            """INSERT OR REPLACE INTO
               app_settings (key, value)
               VALUES ('device_id', ?)""",
            (device_id,))
    except Exception:
        pass
    return device_id


def get_account_id(db) -> str:
    """
    Account-level ID — same across all devices.
    Set when user registers or links account.
    Falls back to device_id if not set.
    """
    try:
        row = db.fetchone(
            "SELECT value FROM app_settings "
            "WHERE key='account_id'")
        if row and row["value"]:
            return row["value"]
    except Exception:
        pass
    return get_device_id(db)


def set_account_id(db, account_id: str):
    """Link this device to an account."""
    try:
        db.execute(
            """INSERT OR REPLACE INTO
               app_settings (key, value)
               VALUES ('account_id', ?)""",
            (account_id,))
        return True
    except Exception:
        return False

