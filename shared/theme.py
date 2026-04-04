# THE SYSTEM — Design Tokens

# Colors
BG          = "#050810"
BG2         = "#080d1a"
PANEL       = "#0a1020"
BORDER      = "#1a2a4a"
ACCENT      = "#4a9eff"
ACCENT2     = "#00d4ff"
GOLD        = "#ffd700"
PURPLE      = "#8b5cf6"
GREEN       = "#00ff88"
RED         = "#ff4466"
ORANGE      = "#ff8c00"
TEXT        = "#c8d8f0"
TEXT_DIM    = "#4a6080"
WHITE       = "#ffffff"

# Stat colors mapped by name
STAT_COLORS = {
    "Body":      ACCENT,
    "Mind":      ACCENT2,
    "Spirit":    GOLD,
    "Knowledge": GREEN,
    "Financial": ORANGE,
    "Dexterity": PURPLE,
}

# Rank thresholds
RANK_THRESHOLDS = [
    (0,  "E"),
    (20, "D"),
    (40, "C"),
    (60, "B"),
    (80, "A"),
    (95, "S"),
]

def get_rank(value: float) -> str:
    rank = "E"
    for threshold, r in RANK_THRESHOLDS:
        if value >= threshold:
            rank = r
    return rank

def hex_color(h: str) -> list:
    """Convert hex color string to Kivy RGBA list."""
    h = h.lstrip('#')
    return [int(h[i:i+2], 16)/255 for i in (0, 2, 4)] + [1]

# Financial categories

INCOME_CATEGORIES = [
    "Salary", "Freelance", "Business",
    "Gift", "Investment", "Other"
]

EXPENSE_CATEGORIES = [
    "Food", "Transport", "Education",
    "Health", "Entertainment", "Tithe",
    "Savings", "Utilities", "Clothing", "Other"
]

CURRENCY_SYMBOL = "$/N "



