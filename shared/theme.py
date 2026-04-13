# ── Dee_Cistem Design System ──────────────────────────────────────

_mode = "dark"


def set_mode(mode):
    global _mode
    _mode = mode


def is_dark():
    return _mode == "dark"


DARK = {
    "bg":        "#0C0D14",
    "bg2":       "#11121C",
    "surface":   "#161720",
    "card":      "#1C1E2C",
    "card2":     "#222538",
    "border":    "#2A2D42",
    "border2":   "#363A54",
    "accent":    "#4F8EF7",
    "accent_hi": "#7AABFF",
    "accent_lo": "#4F8EF720",
    "financial": "#34D399",
    "energy":    "#60A5FA",
    "spirit":    "#FBBF24",
    "mind":      "#A78BFA",
    "knowledge": "#34D399",
    "dexterity": "#F472B6",
    "deecadence":"#38BDF8",
    "success":   "#22C55E",
    "warning":   "#F59E0B",
    "error":     "#F87171",
    "text":      "#F0F2FF",
    "text2":     "#9BA3C4",
    "text3":     "#565E82",
    "text4":     "#2E3352",
    "rank_e":    "#565E82",
    "rank_d":    "#34D399",
    "rank_c":    "#60A5FA",
    "rank_b":    "#A78BFA",
    "rank_a":    "#FBBF24",
    "rank_s":    "#F87171",
    "rank_ss":   "#FBBF24",
    "gold":      "#FBBF24",
}

LIGHT = {
    "bg":        "#F5F6FA",
    "bg2":       "#ECEEF6",
    "surface":   "#FFFFFF",
    "card":      "#FFFFFF",
    "card2":     "#F5F6FA",
    "border":    "#DDE1F0",
    "border2":   "#C8CEEA",
    "accent":    "#3B6FD4",
    "accent_hi": "#2952A3",
    "accent_lo": "#3B6FD415",
    "financial": "#059669",
    "energy":    "#2563EB",
    "spirit":    "#D97706",
    "mind":      "#7C3AED",
    "knowledge": "#059669",
    "dexterity": "#DB2777",
    "deecadence":"#0284C7",
    "success":   "#16A34A",
    "warning":   "#D97706",
    "error":     "#DC2626",
    "text":      "#0F1124",
    "text2":     "#4B5280",
    "text3":     "#8890B0",
    "text4":     "#C0C5DC",
    "rank_e":    "#8890B0",
    "rank_d":    "#059669",
    "rank_c":    "#2563EB",
    "rank_b":    "#7C3AED",
    "rank_a":    "#D97706",
    "rank_s":    "#DC2626",
    "rank_ss":   "#D97706",
    "gold":      "#D97706",
}


def t(key):
    return (DARK if is_dark() else LIGHT).get(key, "#FF00FF")


def c(key):
    return hex_color(t(key))


def hex_color(h):
    h = h.lstrip('#')
    if len(h) == 8:
        return [int(h[i:i+2], 16)/255 for i in (0,2,4,6)]
    return [int(h[i:i+2], 16)/255 for i in (0,2,4)] + [1]


RANK_THRESHOLDS = [
    (95,"SS"),(80,"S"),(65,"A"),
    (50,"B"),(35,"C"),(20,"D"),(0,"E"),
]

RANK_COLOR_KEYS = {
    "E":"rank_e","D":"rank_d","C":"rank_c",
    "B":"rank_b","A":"rank_a","S":"rank_s","SS":"rank_ss",
}


def get_rank(value):
    for threshold, rank in RANK_THRESHOLDS:
        if value >= threshold:
            return rank
    return "E"


def rank_color(rank):
    return t(RANK_COLOR_KEYS.get(rank, "rank_e"))


def stat_color(stat_name):
    key_map = {
        "Body":      "energy",
        "Mind":      "mind",
        "Spirit":    "spirit",
        "Knowledge": "knowledge",
        "Financial": "financial",
        "Dexterity": "dexterity",
    }
    return t(key_map.get(stat_name, "accent"))


R = {"sm":[6],"md":[10],"lg":[14],"xl":[20]}
SP = {"xs":4,"sm":8,"md":12,"lg":16,"xl":24}

# ── Backward compatibility ────────────────────────────────────────
ACCENT       = DARK["accent"]
ACCENT2      = DARK["accent_hi"]
GOLD         = DARK["spirit"]
PURPLE       = DARK["mind"]
TEAL         = DARK["deecadence"]
GREEN        = DARK["success"]
RED          = DARK["error"]
ORANGE       = DARK["financial"]
ROSE         = DARK["error"]
BG           = DARK["bg"]
BG2          = DARK["bg2"]
PANEL        = DARK["card"]
BORDER       = DARK["border"]
TEXT         = DARK["text"]
TEXT_DIM     = DARK["text2"]
WHITE        = "#FFFFFF"

STAT_COLORS = {
    "Body":      DARK["energy"],
    "Mind":      DARK["mind"],
    "Spirit":    DARK["spirit"],
    "Knowledge": DARK["knowledge"],
    "Financial": DARK["financial"],
    "Dexterity": DARK["dexterity"],
}

INCOME_CATEGORIES = [
    "Salary","Freelance","Business",
    "Gift","Investment","Other"
]
EXPENSE_CATEGORIES = [
    "Food","Transport","Education",
    "Health","Entertainment","Tithe",
    "Savings","Utilities","Clothing","Other"
]
CURRENCY_SYMBOL = "$"


def app_font(bold=False):
    try:
        from kivy.app import App
        return getattr(App.get_running_app(), 'font_name', 'Roboto')
    except Exception:
        return 'Roboto'