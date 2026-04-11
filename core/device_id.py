"""
Generates and persists a unique device ID.
Used to identify this installation in Supabase.
"""
import uuid
import os


def get_device_id(db) -> str:
    """
    Returns persistent device ID.
    Creates one on first call, stores in app_settings.
    """
    try:
        row = db.fetchone(
            "SELECT value FROM app_settings "
            "WHERE key='device_id'")
        if row and row["value"]:
            return row["value"]
    except Exception:
        pass

    # Generate new ID
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
