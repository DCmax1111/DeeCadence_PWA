import time
import threading
from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.card import MDCard
from kivymd.uix.progressbar import MDProgressBar
from kivy.app import App
from kivy.metrics import dp
from kivy.clock import Clock
from kivy.uix.widget import Widget
from kivy.graphics import Color, Rectangle, RoundedRectangle
from shared.components import top_nav
from shared.theme import hex_color
from modules.dexterity.controller import DexterityController
from modules.dexterity.model import (
    midi_to_note, note_to_midi, MIDI_TO_NOTE
)

# ── Palette ───────────────────────────────────────────────────────
BG      = "#0A0E1A"
SURFACE = "#111827"
CARD    = "#1A2235"
ACCENT  = "#7C3AED"
TEAL    = "#14B8A6"
GOLD    = "#F59E0B"
ROSE    = "#F43F5E"
TEXT    = "#F1F5F9"
DIM     = "#6B7280"
GREEN   = "#22C55E"
AMBER   = "#F59E0B"
RED_C   = "#EF4444"

def _c(h): return hex_color(h)

RANK_COLORS = {
    "E":  "#6B7280",
    "D":  "#22C55E",
    "C":  "#3B82F6",
    "B":  "#8B5CF6",
    "A":  "#F59E0B",
    "S":  "#F43F5E",
    "SS": "#F59E0B",
}

# ── Artist database (46 artists) ──────────────────────────────────
ARTISTS = [
    ("Dimash Kudaibergen",  21, 110),  # A1–D#8 confirmed live
    ("Tim Storms",          -4,  52),  # G#-1–E3
    ("Barry White",         28,  57),  # E2–A3
    ("Johnny Cash",         28,  60),  # E2–C4
    ("Vin Diesel",          29,  57),  # F2–A3
    ("Josh Turner",         30,  62),  # F#2–D4
    ("Leonard Cohen",       33,  60),  # A2–C4
    ("Louis Armstrong",     33,  64),  # A2–E4
    ("Elvis Presley",       33,  69),  # A2–A4
    ("Frank Sinatra",       35,  67),  # B2–G4
    ("Dean Martin",         36,  67),  # C3–G4
    ("Nat King Cole",       36,  69),  # C3–A4
    ("Michael Buble",       38,  69),  # D3–A4
    ("Freddie Mercury",     36,  76),  # C3–E5
    ("David Bowie",         38,  74),  # D3–D5
    ("Elton John",          40,  74),  # E3–D5
    ("Bruno Mars",          40,  76),  # E3–E5
    ("Ed Sheeran",          40,  72),  # E3–C5
    ("Chris Martin",        40,  76),  # E3–E5
    ("John Legend",         40,  72),  # E3–C5
    ("Justin Timberlake",   43,  79),  # G3–G5
    ("Michael Jackson",     43,  81),  # G3–A5
    ("Prince",              38,  81),  # D3–A5
    ("Stevie Wonder",       36,  76),  # C3–E5
    ("Adam Levine",         43,  79),  # G3–G5
    ("Sam Smith",           40,  76),  # E3–E5
    ("Thom Yorke",          43,  72),  # G3–C5
    ("Jeff Buckley",        40,  83),  # E3–B5
    ("Axl Rose",            31,  86),  # G2–D6
    ("Mariah Carey",        44,  103), # G#3–B7
    ("Whitney Houston",     45,  83),  # A3–B5
    ("Celine Dion",         45,  84),  # A3–C6
    ("Adele",               43,  79),  # G3–G5
    ("Beyonce",             45,  86),  # A3–D6
    ("Christina Aguilera",  43,  88),  # G3–E6
    ("Lady Gaga",           43,  79),  # G3–G5
    ("Ariana Grande",       48,  91),  # C4–G6
    ("Tori Amos",           45,  86),  # A3–D6
    ("Bjork",               43,  88),  # G3–E6
    ("Kate Bush",           45,  88),  # A3–E6
    ("Dolly Parton",        43,  79),  # G3–G5
    ("Patsy Cline",         43,  76),  # G3–E5
    ("Ella Fitzgerald",     45,  91),  # A3–G6
    ("Sarah Vaughan",       40,  83),  # E3–B5
    ("Nina Simone",         38,  74),  # D3–D5
    ("Billie Holiday",      40,  72),  # E3–C5
]

# ── Warmup exercises ──────────────────────────────────────────────
WARMUP_EXERCISES = [
    {
        "name": "Lip Trills",
        "description": "Sustain pitch on a lip buzz. Slide slowly up then down your range.",
        "target_zone": "full_range",
        "steps": [
            {"instruction": "Relax your lips and blow air through them to create a trill",
             "duration": 10, "target": "any"},
            {"instruction": "Hold a comfortable mid note on the trill — steady pitch",
             "duration": 8, "target": "midpoint"},
            {"instruction": "Slowly slide UP to your ceiling on the trill",
             "duration": 10, "target": "ascending"},
            {"instruction": "Slowly slide DOWN to your floor on the trill",
             "duration": 10, "target": "descending"},
        ]
    },
    {
        "name": "Humming Scale",
        "description": "Hum up a major scale, hold each note 2 seconds.",
        "target_zone": "mid_to_high",
        "steps": [
            {"instruction": "Start on your comfortable speaking pitch — hum steadily",
             "duration": 4, "target": "midpoint"},
            {"instruction": "Step up the scale one note at a time — hold each 2 seconds",
             "duration": 16, "target": "ascending"},
            {"instruction": "Hold your highest comfortable note — don't strain",
             "duration": 6, "target": "high"},
            {"instruction": "Step back down the scale slowly",
             "duration": 12, "target": "descending"},
        ]
    },
    {
        "name": "Sirens",
        "description": "Glide continuously from your lowest to highest and back. No breaks.",
        "target_zone": "full_range",
        "steps": [
            {"instruction": "Start at your lowest note — find it gently",
             "duration": 4, "target": "low"},
            {"instruction": "Glide smoothly UP through your entire range — no jumps",
             "duration": 8, "target": "ascending"},
            {"instruction": "Glide smoothly DOWN back to your floor",
             "duration": 8, "target": "descending"},
            {"instruction": "Repeat the full siren — this time faster",
             "duration": 12, "target": "full_range"},
        ]
    },
    {
        "name": "Vowel Sustain",
        "description": "Hold AH — EE — OO on the same target note.",
        "target_zone": "mid_range",
        "steps": [
            {"instruction": "Sing AH on your mid note — hold steady for 5 seconds",
             "duration": 6, "target": "midpoint"},
            {"instruction": "Same note — switch to EE — hold steady",
             "duration": 6, "target": "midpoint"},
            {"instruction": "Same note — switch to OO — hold steady",
             "duration": 6, "target": "midpoint"},
            {"instruction": "Move up 3 semitones and repeat AH — EE — OO",
             "duration": 18, "target": "mid_high"},
        ]
    },
    {
        "name": "Octave Jumps",
        "description": "Jump cleanly between a note and its octave above.",
        "target_zone": "mid_to_high",
        "steps": [
            {"instruction": "Sing a comfortable mid note — hold it 2 seconds",
             "duration": 4, "target": "midpoint"},
            {"instruction": "Jump up exactly one octave — land cleanly",
             "duration": 4, "target": "octave_up"},
            {"instruction": "Jump back down — no glide, clean switch",
             "duration": 4, "target": "midpoint"},
            {"instruction": "Repeat the octave jump 4 times in rhythm",
             "duration": 16, "target": "alternating"},
        ]
    },
    {
        "name": "5-Tone Scale",
        "description": "Do-Re-Mi-Fa-Sol-Fa-Mi-Re-Do on AH, EE, OO.",
        "target_zone": "mid_range",
        "steps": [
            {"instruction": "Sing Do-Re-Mi-Fa-Sol-Fa-Mi-Re-Do on AH",
             "duration": 10, "target": "ascending_descending"},
            {"instruction": "Same scale on EE",
             "duration": 10, "target": "ascending_descending"},
            {"instruction": "Same scale on OO",
             "duration": 10, "target": "ascending_descending"},
            {"instruction": "Repeat starting 2 semitones higher",
             "duration": 30, "target": "ascending_descending"},
        ]
    },
    {
        "name": "Tongue Trill",
        "description": "Rolled R sustained across a scale.",
        "target_zone": "full_range",
        "steps": [
            {"instruction": "Roll your R on a comfortable mid note",
             "duration": 6, "target": "midpoint"},
            {"instruction": "Slide up your range on the rolled R",
             "duration": 8, "target": "ascending"},
            {"instruction": "Slide back down slowly",
             "duration": 8, "target": "descending"},
            {"instruction": "Hold your ceiling note on the trill",
             "duration": 10, "target": "high"},
        ]
    },
]


# ── Pitch detection helper ────────────────────────────────────────
def freq_to_midi(freq):
    if freq <= 0:
        return None
    import math
    midi = 69 + 12 * math.log2(freq / 440.0)
    return round(midi)

def detect_pitch_aubio(audio_buffer, sample_rate=22050):
    """Returns (midi, freq) or (None, None)."""
    try:
        import aubio
        buf_size = len(audio_buffer)
        pitch_o = aubio.pitch("yin", buf_size, buf_size, sample_rate)
        pitch_o.set_unit("Hz")
        pitch_o.set_silence(-40)
        import numpy as np
        samples = np.array(audio_buffer, dtype="float32")
        freq = pitch_o(samples)[0]
        conf = pitch_o.get_confidence()
        if freq > 50 and conf > 0.7:
            return freq_to_midi(freq), freq
    except Exception:
        pass
    return None, None


# ── PitchMeter widget ─────────────────────────────────────────────
class PitchMeterWidget(Widget):
    """Live bar chart of last N pitch detections."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.readings = []
        self.max_readings = 60
        self.bind(size=self._redraw, pos=self._redraw)

    def update(self, midi_val):
        self.readings.append(midi_val)
        if len(self.readings) > self.max_readings:
            self.readings.pop(0)
        self._redraw()

    def _redraw(self, *args):
        self.canvas.clear()
        if not self.readings:
            return
        w, h = self.width, self.height
        n = len(self.readings)
        bar_w = max(2, w / self.max_readings)
        midi_min = 24
        midi_max = 96

        with self.canvas:
            for i, val in enumerate(self.readings):
                if val is None:
                    continue
                norm = (val - midi_min) / (midi_max - midi_min)
                norm = max(0, min(1, norm))
                bar_h = norm * h
                x = self.x + i * bar_w
                y = self.y
                alpha = 0.4 + 0.6 * (i / max(1, n))
                Color(0.49, 0.23, 0.93, alpha)
                Rectangle(pos=(x, y), size=(bar_w - 1, bar_h))


# ── VoxScopeScreen ────────────────────────────────────────────────
class VoxScopeScreen(MDScreen):
    """
    Four internal views managed by view-swap:
    home | warmup_menu | warmup_session | performance | results
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c(BG)
        self._built = False
        self._current_view = "home"

        # Audio state
        self._recording = False
        self._audio_thread = None
        self._audio_buffer = []
        self._pitch_history = []
        self._session_start_time = None
        self._hold_timer = 0.0
        self._hold_note = None
        self._hold_start = None
        self._longest_hold = 0.0
        self._ceiling_midi = None
        self._ceiling_note = ""
        self._cold_to_peak = None
        self._session_low_midi = None
        self._session_high_midi = None
        self._session_low_note = ""
        self._session_high_note = ""
        self._clock_event = None

        # Warmup state
        self._warmup_exercise = None
        self._warmup_step_idx = 0
        self._warmup_step_timer = 0
        self._warmup_step_clock = None
        self._warmup_target_scores = []
        self._warmup_step_hits = 0
        self._warmup_step_total = 0

        # Results state
        self._result_data = {}

        # Content container
        self._content = None

    def on_enter(self):
        if not self._built:
            self._build_shell()
            self._built = True
        self._show_view("home")

    def on_leave(self):
        self._stop_recording()
        if self._clock_event:
            self._clock_event.cancel()
            self._clock_event = None
        if self._warmup_step_clock:
            self._warmup_step_clock.cancel()
            self._warmup_step_clock = None

    def _build_shell(self):
        self._root = MDBoxLayout(orientation="vertical")
        self._nav_bar = top_nav(
            self, "⚔  VOXSCOPE", ACCENT,
            back_screen="dexterity")
        self._root.add_widget(self._nav_bar)
        self._content = MDBoxLayout(orientation="vertical")
        self._root.add_widget(self._content)
        self.add_widget(self._root)

    def _show_view(self, view_name, **kwargs):
        self._current_view = view_name
        self._content.clear_widgets()
        if view_name == "home":
            self._content.add_widget(self._build_home())
        elif view_name == "warmup_menu":
            self._content.add_widget(self._build_warmup_menu())
        elif view_name == "warmup_session":
            self._content.add_widget(
                self._build_warmup_session(kwargs.get("exercise")))
        elif view_name == "performance":
            self._content.add_widget(self._build_performance())
        elif view_name == "results":
            self._content.add_widget(
                self._build_results(kwargs.get("data", {})))

    # ── HOME VIEW ─────────────────────────────────────────────────

    def _build_home(self):
        app = App.get_running_app()
        ctrl = DexterityController(app.db)
        stats = ctrl.get_vocal_stats()
        history = ctrl.get_vocal_history(5)

        rank = stats["rank"]
        rank_color = RANK_COLORS.get(rank, DIM)

        root = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(14),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Rank badge ────────────────────────────────────────────
        badge_row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(64),
            spacing=dp(12)
        )
        badge = MDCard(
            radius=[8], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_x=None, width=dp(72),
            md_bg_color=_c(rank_color + "33")
        )
        badge.add_widget(MDLabel(
            text=f"[b]{rank}[/b]",
            markup=True,
            font_style="H5",
            theme_text_color="Custom",
            text_color=_c(rank_color),
            halign="center", valign="middle"
        ))
        badge_row.add_widget(badge)

        badge_info = MDBoxLayout(orientation="vertical")
        badge_info.add_widget(MDLabel(
            text=stats["voice_type"],
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(TEXT), bold=True,
            size_hint_y=0.5
        ))
        badge_info.add_widget(MDLabel(
            text=f"\"{stats['title']}\"",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(GOLD),
            size_hint_y=0.5
        ))
        badge_row.add_widget(badge_info)
        body.add_widget(badge_row)

        # ── XP bar ────────────────────────────────────────────────
        xp_card = MDCard(
            orientation="vertical",
            radius=[8], elevation=0,
            padding=[dp(14), dp(10)],
            size_hint_y=None, height=dp(72),
            md_bg_color=_c(CARD)
        )
        xp_top = MDBoxLayout(orientation="horizontal",
                             size_hint_y=None, height=dp(24))
        xp_top.add_widget(MDLabel(
            text=f"Level {stats['level']}",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(TEXT), bold=True
        ))
        xp_top.add_widget(MDLabel(
            text=f"{stats['xp_remainder']} / {stats['xp_to_next']} XP",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DIM),
            halign="right"
        ))
        xp_card.add_widget(xp_top)

        xp_pct = (stats["xp_remainder"] / max(1, stats["xp_to_next"]))
        xp_bar = MDProgressBar(
            value=xp_pct * 100,
            color=_c(GOLD),
            size_hint_y=None, height=dp(6)
        )
        xp_card.add_widget(xp_bar)
        xp_card.add_widget(MDLabel(
            text=f"to Level {stats['level'] + 1}",
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(DIM),
            size_hint_y=None, height=dp(18)
        ))
        body.add_widget(xp_card)

        # ── Stats row ─────────────────────────────────────────────
        stats_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(8),
            size_hint_y=None, height=dp(72)
        )
        for label, val in [
            ("BEST RANGE",    stats["best_range"]),
            ("SEMITONES",     str(stats["best_semitones"])),
            ("STREAK",        f"{stats['streak']}d"),
        ]:
            card = MDCard(
                orientation="vertical",
                radius=[8], elevation=0,
                padding=dp(8), size_hint_x=1/3,
                md_bg_color=_c(CARD)
            )
            card.add_widget(MDLabel(
                text=label, font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(DIM), halign="center"
            ))
            card.add_widget(MDLabel(
                text=val, font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(TEXT),
                halign="center", bold=True
            ))
            stats_row.add_widget(card)
        body.add_widget(stats_row)

        # ── Action buttons ────────────────────────────────────────
        btn_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(52)
        )
        perf_btn = MDRaisedButton(
            text="🎤  PERFORMANCE",
            md_bg_color=_c(ACCENT),
            size_hint_x=0.5
        )
        perf_btn.bind(on_release=lambda x: self._show_view("performance"))
        warmup_btn = MDRaisedButton(
            text="🔥  WARMUP",
            md_bg_color=_c(TEAL),
            size_hint_x=0.5
        )
        warmup_btn.bind(
            on_release=lambda x: self._show_view("warmup_menu"))
        btn_row.add_widget(perf_btn)
        btn_row.add_widget(warmup_btn)
        body.add_widget(btn_row)

        # ── Session history ───────────────────────────────────────
        if history:
            body.add_widget(MDLabel(
                text="RECENT SESSIONS",
                font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(DIM),
                size_hint_y=None, height=dp(28)
            ))
            for s in history:
                is_warmup = s["session_type"] == "warmup"
                color = TEAL if is_warmup else ACCENT
                label = (s["exercise_name"] or "Warmup") \
                    if is_warmup else \
                    f"{s['low_note']}–{s['high_note']} · {s['semitones']}st"
                body.add_widget(self._history_row(
                    label, s["date"], color))

        root.add_widget(body)
        return root

    def _history_row(self, label, date, color):
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(44),
            md_bg_color=_c(CARD), spacing=dp(8)
        )
        row.add_widget(MDLabel(
            text=label, font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(color)
        ))
        row.add_widget(MDLabel(
            text=date, font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DIM), halign="right"
        ))
        return row

    # ── WARMUP MENU ───────────────────────────────────────────────

    def _build_warmup_menu(self):
        app = App.get_running_app()
        ctrl = DexterityController(app.db)

        root = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        back_btn = MDFlatButton(
            text="← Back",
            theme_text_color="Custom",
            text_color=_c(DIM),
            size_hint_y=None, height=dp(36)
        )
        back_btn.bind(
            on_release=lambda x: self._show_view("home"))
        body.add_widget(back_btn)

        body.add_widget(MDLabel(
            text="🔥  WARMUP EXERCISES",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(TEAL), bold=True,
            size_hint_y=None, height=dp(36)
        ))

        for i in range(0, len(WARMUP_EXERCISES), 2):
            row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(10),
                size_hint_y=None, height=dp(110)
            )
            for j in range(2):
                if i + j < len(WARMUP_EXERCISES):
                    ex = WARMUP_EXERCISES[i + j]
                    best = ctrl.get_warmup_best(ex["name"])
                    best_str = (f"{int(best*100)}% PB"
                                if best else "No sessions")
                    card = MDCard(
                        orientation="vertical",
                        radius=[10], elevation=0,
                        padding=[dp(12), dp(10)],
                        size_hint_x=0.5,
                        md_bg_color=_c(CARD)
                    )
                    card.add_widget(MDLabel(
                        text=ex["name"],
                        font_style="Body1",
                        theme_text_color="Custom",
                        text_color=_c(TEAL),
                        bold=True,
                        size_hint_y=None, height=dp(24)
                    ))
                    card.add_widget(MDLabel(
                        text=ex["description"][:50] + "...",
                        font_style="Caption",
                        theme_text_color="Custom",
                        text_color=_c(DIM),
                        size_hint_y=None, height=dp(32)
                    ))
                    card.add_widget(MDLabel(
                        text=best_str,
                        font_style="Overline",
                        theme_text_color="Custom",
                        text_color=_c(GOLD),
                        size_hint_y=None, height=dp(20)
                    ))
                    ex_ref = ex
                    card.bind(on_release=lambda x, e=ex_ref:
                              self._show_view("warmup_session",
                                             exercise=e))
                    row.add_widget(card)
                else:
                    row.add_widget(MDBoxLayout(size_hint_x=0.5))
            body.add_widget(row)

        root.add_widget(body)
        return root

    # ── WARMUP SESSION ────────────────────────────────────────────

    def _build_warmup_session(self, exercise):
        if not exercise:
            self._show_view("warmup_menu")
            return MDBoxLayout()

        self._warmup_exercise = exercise
        self._warmup_step_idx = 0
        self._warmup_step_timer = 0
        self._warmup_target_scores = []
        self._warmup_step_hits = 0
        self._warmup_step_total = 0

        root = MDBoxLayout(orientation="vertical",
                           padding=dp(16), spacing=dp(14))

        back_btn = MDFlatButton(
            text="← Back",
            theme_text_color="Custom",
            text_color=_c(DIM),
            size_hint_y=None, height=dp(36)
        )
        back_btn.bind(
            on_release=lambda x: self._end_warmup_session())
        root.add_widget(back_btn)

        root.add_widget(MDLabel(
            text=exercise["name"],
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(TEAL), bold=True,
            size_hint_y=None, height=dp(36)
        ))

        # Step instruction
        self._warmup_instruction = MDLabel(
            text="",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(TEXT),
            size_hint_y=None, height=dp(60),
            halign="center"
        )
        root.add_widget(self._warmup_instruction)

        # Step timer
        self._warmup_timer_label = MDLabel(
            text="",
            font_style="H4",
            theme_text_color="Custom",
            text_color=_c(TEAL),
            size_hint_y=None, height=dp(56),
            halign="center"
        )
        root.add_widget(self._warmup_timer_label)

        # Step dots
        self._warmup_dots = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(20),
            spacing=dp(8)
        )
        total_steps = len(exercise["steps"])
        for i in range(total_steps):
            dot = MDLabel(
                text="●",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=_c(DIM if i > 0 else TEAL),
                size_hint_x=None, width=dp(16)
            )
            self._warmup_dots.add_widget(dot)
        root.add_widget(self._warmup_dots)

        # Pitch zone indicator
        self._warmup_zone_label = MDLabel(
            text="",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(DIM),
            size_hint_y=None, height=dp(28),
            halign="center"
        )
        root.add_widget(self._warmup_zone_label)

        # Accuracy
        self._warmup_accuracy_label = MDLabel(
            text="Accuracy: —",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(GOLD),
            size_hint_y=None, height=dp(32),
            halign="center"
        )
        root.add_widget(self._warmup_accuracy_label)

        self._update_warmup_step_ui()
        self._start_warmup_timer()
        self._start_recording()

        return root

    def _update_warmup_step_ui(self):
        if not self._warmup_exercise:
            return
        steps = self._warmup_exercise["steps"]
        idx = self._warmup_step_idx
        if idx >= len(steps):
            return
        step = steps[idx]
        self._warmup_instruction.text = step["instruction"]
        self._warmup_timer_label.text = str(step["duration"])
        for i, dot_widget in enumerate(
                self._warmup_dots.children[::-1]):
            dot_widget.color = (
                _c(TEAL) if i <= idx else _c(DIM))

    def _start_warmup_timer(self):
        if self._warmup_step_clock:
            self._warmup_step_clock.cancel()
        steps = self._warmup_exercise["steps"]
        self._warmup_step_timer = steps[
            self._warmup_step_idx]["duration"]
        self._warmup_step_clock = Clock.schedule_interval(
            self._warmup_tick, 1)

    def _warmup_tick(self, dt):
        self._warmup_step_timer -= 1
        try:
            self._warmup_timer_label.text = str(
                max(0, self._warmup_step_timer))
        except Exception:
            pass
        if self._warmup_step_timer <= 0:
            self._warmup_step_idx += 1
            steps = self._warmup_exercise["steps"]
            if self._warmup_step_idx >= len(steps):
                self._warmup_step_clock.cancel()
                self._finish_warmup()
            else:
                self._update_warmup_step_ui()
                self._start_warmup_timer()

    def _finish_warmup(self):
        self._stop_recording()
        total = self._warmup_step_total
        hits = self._warmup_step_hits
        accuracy = hits / max(1, total)
        self._result_data = {
            "session_type":   "warmup",
            "exercise_name":  self._warmup_exercise["name"],
            "accuracy_score": accuracy,
            "low_note": "—", "high_note": "—",
            "low_midi": 0, "high_midi": 0,
            "semitones": 0,
            "tess_low": 0, "tess_high": 0,
            "voice_type": "Unknown",
            "peak_duration": 0, "cold_to_peak": None,
        }
        self._show_view("results", data=self._result_data)

    def _end_warmup_session(self):
        self._stop_recording()
        if self._warmup_step_clock:
            self._warmup_step_clock.cancel()
        self._show_view("warmup_menu")

    # ── PERFORMANCE VIEW ──────────────────────────────────────────

    def _build_performance(self):
        self._reset_session_state()

        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(16), spacing=dp(12))

        back_btn = MDFlatButton(
            text="← Back",
            theme_text_color="Custom",
            text_color=_c(DIM),
            size_hint_y=None, height=dp(36)
        )
        back_btn.bind(
            on_release=lambda x: self._abort_performance())
        root.add_widget(back_btn)

        root.add_widget(MDLabel(
            text="🎤  PERFORMANCE SESSION",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(ACCENT), bold=True,
            size_hint_y=None, height=dp(36)
        ))

        # Pitch meter
        self._pitch_meter = PitchMeterWidget(
            size_hint_y=None, height=dp(80))
        root.add_widget(self._pitch_meter)

        # Current note display
        self._current_note_label = MDLabel(
            text="— Hz",
            font_style="H4",
            theme_text_color="Custom",
            text_color=_c(ACCENT),
            size_hint_y=None, height=dp(56),
            halign="center"
        )
        root.add_widget(self._current_note_label)

        # Hold timer
        self._hold_label = MDLabel(
            text="Hold: 0.0s",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(TEAL),
            size_hint_y=None, height=dp(28),
            halign="center"
        )
        root.add_widget(self._hold_label)

        # Session ceiling
        self._ceiling_label = MDLabel(
            text="Ceiling: —",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(GOLD),
            size_hint_y=None, height=dp(24),
            halign="center"
        )
        root.add_widget(self._ceiling_label)

        # Cold to peak
        self._cold_label = MDLabel(
            text="Cold-to-peak: timing...",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DIM),
            size_hint_y=None, height=dp(20),
            halign="center"
        )
        root.add_widget(self._cold_label)

        # Stop button
        stop_btn = MDRaisedButton(
            text="■  STOP",
            md_bg_color=_c(ROSE),
            size_hint_y=None, height=dp(48)
        )
        stop_btn.bind(on_release=lambda x: self._stop_performance())
        root.add_widget(stop_btn)

        self._start_recording()
        self._session_start_time = time.time()
        self._clock_event = Clock.schedule_interval(
            self._performance_tick, 0.05)

        # Auto-stop at 15 minutes
        Clock.schedule_once(
            lambda dt: self._stop_performance(), 900)

        return root

    def _reset_session_state(self):
        self._pitch_history = []
        self._hold_timer = 0.0
        self._hold_note = None
        self._hold_start = None
        self._longest_hold = 0.0
        self._ceiling_midi = None
        self._ceiling_note = ""
        self._cold_to_peak = None
        self._session_low_midi = None
        self._session_high_midi = None
        self._session_low_note = ""
        self._session_high_note = ""

    def _performance_tick(self, dt):
        if not self._pitch_history:
            return

        latest = self._pitch_history[-1] if self._pitch_history else None
        if latest is None:
            return

        midi, freq = latest
        now = time.time()

        try:
            self._current_note_label.text = (
                f"{midi_to_note(midi)}  ·  {freq:.1f} Hz"
                if midi else "— Hz")
        except Exception:
            pass

        if midi:
            # Update session range
            if (self._session_low_midi is None or
                    midi < self._session_low_midi):
                self._session_low_midi = midi
                self._session_low_note = midi_to_note(midi)
            if (self._session_high_midi is None or
                    midi > self._session_high_midi):
                self._session_high_midi = midi
                self._session_high_note = midi_to_note(midi)

            # Hold timer — ±1 semitone tolerance
            if (self._hold_note is not None and
                    abs(midi - self._hold_note) <= 1):
                self._hold_timer = now - self._hold_start
            else:
                self._hold_note = midi
                self._hold_start = now
                self._hold_timer = 0.0

            if self._hold_timer > self._longest_hold:
                self._longest_hold = self._hold_timer

            # Ceiling tracker
            if (self._ceiling_midi is None or
                    midi > self._ceiling_midi):
                self._ceiling_midi = midi
                self._ceiling_note = midi_to_note(midi)
                if self._cold_to_peak is None:
                    self._cold_to_peak = (
                        now - self._session_start_time)

            try:
                self._hold_label.text = (
                    f"Hold: {self._hold_timer:.1f}s")
                self._ceiling_label.text = (
                    f"Ceiling: {self._ceiling_note}")
                if self._cold_to_peak:
                    self._cold_label.text = (
                        f"Cold-to-peak: {self._cold_to_peak:.1f}s")
            except Exception:
                pass

            try:
                self._pitch_meter.update(midi)
            except Exception:
                pass

    def _stop_performance(self):
        self._stop_recording()
        if self._clock_event:
            self._clock_event.cancel()
            self._clock_event = None

        low = self._session_low_midi or 48
        high = self._session_high_midi or 72
        semitones = high - low

        # Estimate tessitura (middle 80% of range)
        tess_margin = max(1, int(semitones * 0.1))
        tess_low = low + tess_margin
        tess_high = high - tess_margin

        # Voice type from tessitura
        from modules.dexterity.model import VOICE_TYPE_RANGES
        mid = (tess_low + tess_high) / 2
        voice_type = "Unknown"
        best_diff = float('inf')
        for vtype, vl, vh in VOICE_TYPE_RANGES:
            vm = (vl + vh) / 2
            diff = abs(mid - vm)
            if diff < best_diff:
                best_diff = diff
                voice_type = vtype

        data = {
            "session_type":  "performance",
            "low_note":      self._session_low_note or "C3",
            "high_note":     self._session_high_note or "C4",
            "low_midi":      low,
            "high_midi":     high,
            "semitones":     semitones,
            "tess_low":      tess_low,
            "tess_high":     tess_high,
            "voice_type":    voice_type,
            "peak_duration": self._longest_hold,
            "cold_to_peak":  self._cold_to_peak,
            "exercise_name": None,
            "accuracy_score": None,
        }
        self._result_data = data
        self._show_view("results", data=data)

    def _abort_performance(self):
        self._stop_recording()
        if self._clock_event:
            self._clock_event.cancel()
            self._clock_event = None
        self._show_view("home")

    # ── RESULTS VIEW ──────────────────────────────────────────────

    def _build_results(self, data):
        is_warmup = data.get("session_type") == "warmup"

        root = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(14),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        body.add_widget(MDLabel(
            text="SESSION RESULTS",
            font_style="H6",
            theme_text_color="Custom",
            text_color=_c(TEXT), bold=True,
            size_hint_y=None, height=dp(36)
        ))

        if is_warmup:
            acc = data.get("accuracy_score", 0)
            ex_name = data.get("exercise_name", "Warmup")
            body.add_widget(MDLabel(
                text=ex_name,
                font_style="H5",
                theme_text_color="Custom",
                text_color=_c(TEAL), bold=True,
                size_hint_y=None, height=dp(40)
            ))
            body.add_widget(MDLabel(
                text=f"Accuracy: {int(acc*100)}%",
                font_style="H4",
                theme_text_color="Custom",
                text_color=_c(GOLD),
                size_hint_y=None, height=dp(48),
                halign="center"
            ))
        else:
            # Stat cards
            stats_row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(8),
                size_hint_y=None, height=dp(80)
            )
            for label, val in [
                ("LOWEST",    data.get("low_note", "—")),
                ("HIGHEST",   data.get("high_note", "—")),
                ("SEMITONES", str(data.get("semitones", 0))),
                ("VOICE",     data.get("voice_type", "—")),
            ]:
                card = MDCard(
                    orientation="vertical",
                    radius=[8], elevation=0,
                    padding=dp(8), size_hint_x=0.25,
                    md_bg_color=_c(CARD)
                )
                card.add_widget(MDLabel(
                    text=label, font_style="Overline",
                    theme_text_color="Custom",
                    text_color=_c(DIM), halign="center"
                ))
                card.add_widget(MDLabel(
                    text=val, font_style="Body2",
                    theme_text_color="Custom",
                    text_color=_c(TEXT),
                    halign="center", bold=True
                ))
                stats_row.add_widget(card)
            body.add_widget(stats_row)

            # Peak hold info
            body.add_widget(MDLabel(
                text=f"Longest hold: {data.get('peak_duration', 0):.1f}s  ·  "
                     f"Cold-to-peak: {data.get('cold_to_peak') or '—'}",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=_c(DIM),
                size_hint_y=None, height=dp(24)
            ))

            # Artist comparison
            body.add_widget(MDLabel(
                text="SIMILAR RANGES",
                font_style="Overline",
                theme_text_color="Custom",
                text_color=_c(DIM),
                size_hint_y=None, height=dp(24)
            ))
            low = data.get("low_midi", 48)
            high = data.get("high_midi", 72)
            similar = self._get_similar_artists(low, high, 5)
            for name, a_low, a_high, similarity in similar:
                body.add_widget(self._artist_row(
                    name, a_low, a_high, similarity))

        # XP preview (computed on save)
        self._xp_preview_container = MDBoxLayout(
            orientation="vertical",
            size_hint_y=None, height=dp(48)
        )
        self._xp_preview_container.add_widget(MDLabel(
            text="XP will be calculated on save.",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DIM), halign="center"
        ))
        body.add_widget(self._xp_preview_container)

        # Buttons
        btn_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(52)
        )
        save_btn = MDRaisedButton(
            text="SAVE TO SYSTEM",
            md_bg_color=_c(ACCENT),
            size_hint_x=0.6
        )
        save_btn.bind(on_release=lambda x: self._save_results(data))
        discard_btn = MDFlatButton(
            text="DISCARD",
            theme_text_color="Custom",
            text_color=_c(DIM),
            size_hint_x=0.4
        )
        discard_btn.bind(on_release=lambda x: setattr(
            self.manager, "current", "dexterity"))
        btn_row.add_widget(save_btn)
        btn_row.add_widget(discard_btn)
        body.add_widget(btn_row)

        root.add_widget(body)
        return root

    def _get_similar_artists(self, low, high, n=5):
        semitones = high - low
        scored = []
        for name, a_low, a_high in ARTISTS:
            a_semi = a_high - a_low
            overlap_low = max(low, a_low)
            overlap_high = min(high, a_high)
            overlap = max(0, overlap_high - overlap_low)
            union = max(1, min(semitones, a_semi) +
                        abs(semitones - a_semi))
            similarity = overlap / union
            scored.append((name, a_low, a_high, similarity))
        scored.sort(key=lambda x: x[3], reverse=True)
        return scored[:n]

    def _artist_row(self, name, a_low, a_high, similarity):
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(10), dp(6)],
            size_hint_y=None, height=dp(44),
            md_bg_color=_c(CARD), spacing=dp(8)
        )
        row.add_widget(MDLabel(
            text=name, font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(TEXT), size_hint_x=0.45
        ))
        row.add_widget(MDLabel(
            text=f"{midi_to_note(a_low)}–{midi_to_note(a_high)}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(DIM), size_hint_x=0.35
        ))
        row.add_widget(MDLabel(
            text=f"{int(similarity*100)}%",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(GOLD),
            halign="right", size_hint_x=0.2
        ))
        return row

    def _save_results(self, data):
        app = App.get_running_app()
        ctrl = DexterityController(app.db)
        result = ctrl.log_vocal_session(
            data["session_type"],
            data["low_note"],
            data["high_note"],
            data["low_midi"],
            data["high_midi"],
            data["semitones"],
            data["tess_low"],
            data["tess_high"],
            data["voice_type"],
            data["peak_duration"],
            data["cold_to_peak"],
            data.get("exercise_name"),
            data.get("accuracy_score"),
        )
        self._show_save_feedback(result)

    def _show_save_feedback(self, result):
        self._xp_preview_container.clear_widgets()

        xp = result["xp_earned"]
        breakdown = result["xp_breakdown"]

        if xp > 0:
            self._xp_preview_container.add_widget(MDLabel(
                text=f"+{xp} XP earned",
                font_style="H5",
                theme_text_color="Custom",
                text_color=_c(GOLD), halign="center",
                size_hint_y=None, height=dp(40)
            ))
            for amt, reason in breakdown:
                self._xp_preview_container.add_widget(MDLabel(
                    text=f"+{amt}  {reason}",
                    font_style="Caption",
                    theme_text_color="Custom",
                    text_color=_c(DIM), halign="center",
                    size_hint_y=None, height=dp(20)
                ))
        else:
            self._xp_preview_container.add_widget(MDLabel(
                text="No improvement detected — 0 XP",
                font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(DIM), halign="center",
                size_hint_y=None, height=dp(32)
            ))

        if result["level_up"]:
            self._xp_preview_container.add_widget(MDLabel(
                text=f"🎉 LEVEL UP → Level {result['new_level']}",
                font_style="H6",
                theme_text_color="Custom",
                text_color=_c(GOLD), halign="center",
                size_hint_y=None, height=dp(36)
            ))
        if result["rank_changed"]:
            rc = RANK_COLORS.get(result["rank"], DIM)
            self._xp_preview_container.add_widget(MDLabel(
                text=f"RANK UP → {result['rank']}",
                font_style="H6",
                theme_text_color="Custom",
                text_color=_c(rc), halign="center",
                size_hint_y=None, height=dp(36)
            ))
        if result["title_changed"]:
            self._xp_preview_container.add_widget(MDLabel(
                text=f"NEW TITLE: \"{result['title']}\"",
                font_style="Body1",
                theme_text_color="Custom",
                text_color=_c(TEAL), halign="center",
                size_hint_y=None, height=dp(28)
            ))

        Clock.schedule_once(
            lambda dt: setattr(
                self.manager, "current", "dexterity"), 3)

    # ── Audio recording ───────────────────────────────────────────

    def _start_recording(self):
        self._recording = True
        self._audio_thread = threading.Thread(
            target=self._audio_loop, daemon=True)
        self._audio_thread.start()

    def _stop_recording(self):
        self._recording = False

    def _audio_loop(self):
        try:
            import sounddevice as sd
            import numpy as np
            sample_rate = 22050
            block_size = 2048

            def callback(indata, frames, time_info, status):
                if not self._recording:
                    return
                audio = indata[:, 0].tolist()
                midi, freq = detect_pitch_aubio(audio, sample_rate)
                Clock.schedule_once(
                    lambda dt: self._on_pitch(midi, freq), 0)

                # Warmup accuracy tracking
                if (self._current_view == "warmup_session" and
                        self._warmup_exercise):
                    self._warmup_step_hits += (1 if midi else 0)
                    self._warmup_step_total += 1

            with sd.InputStream(
                    samplerate=sample_rate,
                    blocksize=block_size,
                    channels=1,
                    callback=callback):
                while self._recording:
                    time.sleep(0.05)
        except Exception:
            pass

    def _on_pitch(self, midi, freq):
        self._pitch_history.append((midi, freq))
        if len(self._pitch_history) > 200:
            self._pitch_history.pop(0)

        if self._current_view == "warmup_session":
            try:
                if midi:
                    self._warmup_zone_label.text = (
                        f"Detecting: {midi_to_note(midi)}")
                acc = (self._warmup_step_hits /
                       max(1, self._warmup_step_total))
                self._warmup_accuracy_label.text = (
                    f"Accuracy: {int(acc*100)}%")
            except Exception:
                pass

