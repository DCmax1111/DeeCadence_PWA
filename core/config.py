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

# https://lnxvlpmvhjhvwzunkvts.supabase.co
# sb_publishable_nzhnZFwy21IYBUN99ZEEVg_idJkioO4
# secret - sb_secret_0u59levzMPdYm_g-EgHLpA_I5KDA97v
# eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxueHZscG12aGpodnd6dW5rdnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjY0MDIsImV4cCI6MjA5MTQ0MjQwMn0.VNYvVvgQxMZhpEzCDuKHc_f7grB3bHpwaggGeJXhIhw
# secret - eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxueHZscG12aGpodnd6dW5rdnRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg2NjQwMiwiZXhwIjoyMDkxNDQyNDAyfQ.rRavxlNIqn96ojgFHrIoODPHYMvAm5769rcWtZwzF-M
