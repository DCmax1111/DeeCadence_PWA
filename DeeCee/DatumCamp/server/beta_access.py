"""Beta testing access helper for Python services using supabase-py.

Use this from a Python API/service when deciding whether to bypass normal
subscription checks during a controlled DeeCee testing period.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class _Cache:
    value: bool = False
    expires_at: float = 0.0


_BETA_CACHE = _Cache()


def beta_testing_active(supabase_client, ttl_seconds: int = 30) -> bool:
    """Return True when app_config.beta_testing_active is enabled.

    The result is cached briefly so normal API calls do not query Supabase on
    every request. Pass a Supabase service-role client when this runs server-side.
    """

    now = time.time()
    if _BETA_CACHE.expires_at > now:
        return _BETA_CACHE.value

    try:
        response = (
            supabase_client.table("app_config")
            .select("value")
            .eq("key", "beta_testing_active")
            .limit(1)
            .execute()
        )
        rows = response.data or []
        value = bool(rows and rows[0].get("value"))
    except Exception:
        value = False

    _BETA_CACHE.value = value
    _BETA_CACHE.expires_at = now + max(1, ttl_seconds)
    return value


def has_full_access_for_testing(
    supabase_client,
    user_id: str,
    standard_subscription_check: Callable[[str], bool],
    ttl_seconds: int = 30,
) -> bool:
    """Grant full access in beta mode, otherwise enforce normal validation."""

    if beta_testing_active(supabase_client, ttl_seconds=ttl_seconds):
        return True
    return bool(standard_subscription_check(user_id))


def clear_beta_testing_cache() -> None:
    """Clear cache manually after changing app_config during tests/admin flows."""

    _BETA_CACHE.value = False
    _BETA_CACHE.expires_at = 0.0
