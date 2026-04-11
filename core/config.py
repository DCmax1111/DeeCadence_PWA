"""
Runtime configuration.
Keys are injected at build time via
GitHub Actions secrets — never committed.
"""
import os

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    ""  # Empty = sync disabled
)

SUPABASE_ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    ""
)

# Sync is only active when both are present
SYNC_ENABLED = bool(SUPABASE_URL and SUPABASE_ANON_KEY)
