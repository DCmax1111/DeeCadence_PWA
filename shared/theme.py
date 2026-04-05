from kivy.utils import get_color_from_hex


# ── Dynamic theme system ──────────────────────────────────────────

_current_mode = "dark"  # "dark" | "light"


def set_mode(mode):
    global _current_mode
    _current_mode = mode


def get_mode():
    return _current_mode


def is_dark():
    return _current_mode == "dark"


# ── Color tokens — dark mode ──────────────────────────────────────

DARK = {
    "bg":           "#08090F",
    "bg2":          "#0D0F1A",
    "surface":      "#13151F",
    "card":         "#1A1D2E",
    "card2":        "#1F2235",
    "border":       "#252840",
    "border2":      "#2E3150",

    "accent":       "#5B7FFF",
    "accent2":      "#7B9FFF",
    "accent_glow":  "#5B7FFF40",

    "gold":         "#F5C542",
    "gold_dim":     "#F5C54280",
    "purple":       "#8B5CF6",
    "teal":         "#14B8A6",
    "green":        "#22C55E",
    "red":          "#F43F5E",
    "orange":       "#F97316",
    "rose":         "#FB7185",

    "text":         "#F1F5F9",
    "text2":        "#94A3B8",
    "text3":        "#475569",
    "dim":          "#334155",

    "rank_e":       "#64748B",
    "rank_d":       "#22C55E",
    "rank_c":       "#3B82F6",
    "rank_b":       "#8B5CF6",
    "rank_a":       "#F5C542",
    "rank_s":       "#F43F5E",
    "rank_ss":      "#F5C542",
}

LIGHT = {
    "bg":           "#F8FAFC",
    "bg2":          "#F1F5F9",
    "surface":      "#FFFFFF",
    "card":         "#FFFFFF",
    "card2":        "#F8FAFC",
    "border":       "#E2E8F0",
    "border2":      "#CBD5E1",

    "accent":       "#4361EE",
    "accent2":      "#3A0CA3",
    "accent_glow":  "#4361EE30",

    "gold":         "#D97706",
    "gold_dim":     "#D9770660",
    "purple":       "#7C3AED",
    "teal":         "#0D9488",
    "green":        "#16A34A",
    "red":          "#DC2626",
    "orange":       "#EA580C",
    "rose":         "#E11D48",

    "text":         "#0F172A",
    "text2":        "#475569",
    "text3":        "#94A3B8",
    "dim":          "#CBD5E1",

    "rank_e":       "#64748B",
    "rank_d":       "#16A34A",
    "rank_c":       "#2563EB",
    "rank_b":       "#7C3AED",
    "rank_a":       "#D97706",
    "rank_s":       "#DC2626",
    "rank_ss":      "#D97706",
}


def t(key):
    """Get current theme color by key."""
    palette = DARK if is_dark() else LIGHT
    return palette.get(key, "#FF00FF")


def c(key):
    """Get current theme color as Kivy RGBA list."""
    return hex_color(t(key))


def hex_color(h):
    """Convert hex string to Kivy RGBA list."""
    h = h.lstrip('#')
    if len(h) == 8:
        return [int(h[i:i+2], 16)/255 for i in (0, 2, 4, 6)]
    return [int(h[i:i+2], 16)/255 for i in (0, 2, 4)] + [1]


# ── Stat colors ───────────────────────────────────────────────────

STAT_COLORS = {
    "Body":       "accent",
    "Mind":       "teal",
    "Spirit":     "gold",
    "Knowledge":  "green",
    "Financial":  "orange",
    "Dexterity":  "purple",
}


def stat_color(stat_name):
    return t(STAT_COLORS.get(stat_name, "accent"))


# ── Rank system ───────────────────────────────────────────────────

RANK_THRESHOLDS = [
    (95, "SS"),
    (80, "S"),
    (65, "A"),
    (50, "B"),
    (35, "C"),
    (20, "D"),
    (0,  "E"),
]

RANK_COLOR_KEYS = {
    "E":  "rank_e",
    "D":  "rank_d",
    "C":  "rank_c",
    "B":  "rank_b",
    "A":  "rank_a",
    "S":  "rank_s",
    "SS": "rank_ss",
}


def get_rank(value):
    for threshold, rank in RANK_THRESHOLDS:
        if value >= threshold:
            return rank
    return "E"


def rank_color(rank):
    return t(RANK_COLOR_KEYS.get(rank, "rank_e"))


# ── Typography scale ──────────────────────────────────────────────

FONT_DISPLAY = "H4"
FONT_TITLE   = "H6"
FONT_BODY    = "Body1"
FONT_BODY2   = "Body2"
FONT_CAPTION = "Caption"
FONT_LABEL   = "Overline"
FONT_BUTTON  = "Button"

# ── Spacing ───────────────────────────────────────────────────────

SPACE_XS  = 4
SPACE_SM  = 8
SPACE_MD  = 12
SPACE_LG  = 16
SPACE_XL  = 24
SPACE_2XL = 32

# ── Border radius ─────────────────────────────────────────────────

RADIUS_SM = [6]
RADIUS_MD = [10]
RADIUS_LG = [16]
RADIUS_XL = [24]

# ── Currency ──────────────────────────────────────────────────────

CURRENCY_SYMBOL = "N/$"

INCOME_CATEGORIES = [
    "Salary", "Freelance", "Business",
    "Gift", "Investment", "Other"
]

EXPENSE_CATEGORIES = [
    "Food", "Transport", "Education",
    "Health", "Entertainment", "Tithe",
    "Savings", "Utilities", "Clothing", "Other"
]


