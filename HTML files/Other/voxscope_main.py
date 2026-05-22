"""
VoxScope — Vocal Range Analyzer
Full Kivy app: records voice, detects pitch, analyzes range, compares with artists.
"""

import os
os.environ['KIVY_NO_ENV_CONFIG'] = '1'

import threading
import time
import math
import json
from collections import deque

import numpy as np
import kivy
from kivy.app import App
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.uix.screenmanager import ScreenManager, Screen, FadeTransition
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.widget import Widget
from kivy.graphics import (Color, RoundedRectangle, Rectangle, Ellipse,
                           Line, Canvas, InstructionGroup)
from kivy.properties import (NumericProperty, StringProperty, ListProperty,
                              BooleanProperty, ObjectProperty)
from kivy.animation import Animation
from kivy.metrics import dp, sp
from kivy.utils import get_color_from_hex

# ── CONSTANTS ───────────────────────────────────────────────────────────────

SAMPLE_RATE = 44100
BUFFER_SIZE = 2048
RECORD_SECONDS = 15  # max recording time

# Note names across C1–C8
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# MIDI note 24 = C1, 108 = C8
MIDI_C1 = 24
MIDI_C8 = 120  # extended to C9 to accommodate extreme ranges like Dimash (D#8 = midi 111)

# ── NOTE UTILITIES ───────────────────────────────────────────────────────────

def freq_to_midi(freq):
    if freq <= 0:
        return None
    midi = 69 + 12 * math.log2(freq / 440.0)
    return round(midi)

def midi_to_note_name(midi):
    if midi is None:
        return "—"
    octave = (midi // 12) - 1
    note = NOTE_NAMES[midi % 12]
    return f"{note}{octave}"

def midi_to_freq(midi):
    return 440.0 * (2 ** ((midi - 69) / 12))

def note_name_to_midi(note_str):
    """e.g. 'A2' -> midi int"""
    for i, n in enumerate(NOTE_NAMES):
        if note_str.startswith(n + '#') or note_str.startswith(n):
            octave_str = note_str[len(n):]
            try:
                octave = int(octave_str)
                return (octave + 1) * 12 + i
            except ValueError:
                pass
    return None

def classify_voice_type(low_midi, high_midi):
    """Returns voice type based on comfortable range."""
    mid = (low_midi + high_midi) / 2
    if mid <= 43:   return "Bass"
    elif mid <= 48: return "Bass-Baritone"
    elif mid <= 52: return "Baritone"
    elif mid <= 57: return "Tenor"
    elif mid <= 60: return "Countertenor / High Tenor"
    elif mid <= 64: return "Contralto"
    elif mid <= 67: return "Mezzo-Soprano"
    elif mid <= 72: return "Soprano"
    else:           return "Soprano (Extended)"

def estimate_tessitura(note_counts):
    """
    Given a dict {midi: count}, return (low, high) tessitura
    by trimming outliers (bottom 10% and top 10% of note occurrences).
    """
    if not note_counts:
        return None, None
    sorted_notes = sorted(note_counts.keys())
    total = sum(note_counts.values())
    if total == 0:
        return None, None

    cumulative = 0
    tess_low, tess_high = sorted_notes[0], sorted_notes[-1]
    for note in sorted_notes:
        cumulative += note_counts[note]
        if cumulative / total >= 0.10:
            tess_low = note
            break
    cumulative = 0
    for note in reversed(sorted_notes):
        cumulative += note_counts[note]
        if cumulative / total >= 0.10:
            tess_high = note
            break
    return tess_low, tess_high

# ── ARTIST DATABASE ──────────────────────────────────────────────────────────

ARTISTS = [
    # Bass
    {"name": "Tim Storms",       "low": "G0",  "high": "G5",  "type": "Bass",           "genre": "Gospel/Specialty"},
    {"name": "Barry White",      "low": "C2",  "high": "D4",  "type": "Bass",           "genre": "Soul/R&B"},
    {"name": "Johnny Cash",      "low": "C2",  "high": "A4",  "type": "Bass-Baritone",  "genre": "Country"},
    {"name": "Leonard Cohen",    "low": "C2",  "high": "D4",  "type": "Bass",           "genre": "Folk"},
    # Baritone
    {"name": "Frank Sinatra",    "low": "F2",  "high": "F5",  "type": "Baritone",       "genre": "Jazz/Pop"},
    {"name": "Elvis Presley",    "low": "G2",  "high": "B5",  "type": "Baritone",       "genre": "Rock/Pop"},
    {"name": "Michael Bublé",    "low": "A2",  "high": "G5",  "type": "Baritone",       "genre": "Jazz/Pop"},
    {"name": "Ed Sheeran",       "low": "B2",  "high": "B5",  "type": "Baritone",       "genre": "Pop"},
    {"name": "Bob Dylan",        "low": "C3",  "high": "D5",  "type": "Baritone",       "genre": "Folk/Rock"},
    # Tenor
    {"name": "Freddie Mercury",  "low": "F2",  "high": "F6",  "type": "Tenor",          "genre": "Rock"},
    {"name": "Bruno Mars",       "low": "C3",  "high": "B5",  "type": "Tenor",          "genre": "Pop/R&B"},
    {"name": "Justin Timberlake","low": "A2",  "high": "C6",  "type": "Tenor",          "genre": "Pop/R&B"},
    {"name": "The Weeknd",       "low": "A2",  "high": "F6",  "type": "Tenor",          "genre": "R&B/Pop"},
    {"name": "Drake",            "low": "C3",  "high": "C5",  "type": "Baritone",       "genre": "Hip-Hop/R&B"},
    {"name": "Stevie Wonder",    "low": "C3",  "high": "E6",  "type": "Tenor",          "genre": "Soul/R&B"},
    {"name": "Michael Jackson",  "low": "A2",  "high": "F6",  "type": "Tenor",          "genre": "Pop"},
    {"name": "Prince",           "low": "F2",  "high": "B6",  "type": "Tenor",          "genre": "Pop/R&B/Rock"},
    # Countertenor / High
    {"name": "Jeff Buckley",     "low": "A2",  "high": "E7",  "type": "Countertenor",   "genre": "Rock/Alternative"},
    {"name": "Thom Yorke",       "low": "C3",  "high": "C6",  "type": "Tenor",          "genre": "Alternative"},
    # Female - Contralto
    {"name": "Adele",            "low": "B2",  "high": "E6",  "type": "Mezzo-Soprano",  "genre": "Pop/Soul"},
    {"name": "Amy Winehouse",    "low": "D3",  "high": "D6",  "type": "Mezzo-Soprano",  "genre": "Soul/Jazz"},
    {"name": "Tina Turner",      "low": "D3",  "high": "D6",  "type": "Mezzo-Soprano",  "genre": "Rock/R&B"},
    {"name": "Tracy Chapman",    "low": "G2",  "high": "F5",  "type": "Contralto",      "genre": "Folk"},
    # Mezzo
    {"name": "Beyoncé",          "low": "A2",  "high": "E6",  "type": "Mezzo-Soprano",  "genre": "Pop/R&B"},
    {"name": "Alicia Keys",      "low": "A2",  "high": "E6",  "type": "Mezzo-Soprano",  "genre": "R&B/Soul"},
    {"name": "Rihanna",          "low": "C3",  "high": "C6",  "type": "Mezzo-Soprano",  "genre": "Pop/R&B"},
    {"name": "Madonna",          "low": "F2",  "high": "F6",  "type": "Mezzo-Soprano",  "genre": "Pop"},
    # Soprano
    {"name": "Céline Dion",      "low": "A2",  "high": "C6",  "type": "Soprano",        "genre": "Pop"},
    {"name": "Whitney Houston",  "low": "A2",  "high": "G6",  "type": "Soprano",        "genre": "Pop/R&B"},
    {"name": "Ariana Grande",    "low": "D3",  "high": "E7",  "type": "Soprano",        "genre": "Pop/R&B"},
    {"name": "Mariah Carey",     "low": "F2",  "high": "G7",  "type": "Soprano",        "genre": "Pop/R&B"},
    {"name": "Lady Gaga",        "low": "F2",  "high": "G5",  "type": "Mezzo-Soprano",  "genre": "Pop"},
    {"name": "Taylor Swift",     "low": "D3",  "high": "E5",  "type": "Mezzo-Soprano",  "genre": "Pop/Country"},
    {"name": "Billie Eilish",    "low": "A2",  "high": "B5",  "type": "Mezzo-Soprano",  "genre": "Pop"},
    {"name": "SZA",              "low": "A2",  "high": "B5",  "type": "Mezzo-Soprano",  "genre": "R&B"},
    # Extraordinary / Extended Range
    {"name": "Dimash Kudaibergen","low": "A1", "high": "D#8", "type": "Tenor/Countertenor","genre": "Classical/Pop"},
    {"name": "Yma Sumac",        "low": "B2",  "high": "E7",  "type": "Soprano",        "genre": "Exotica/Classical"},
    {"name": "Mike Patton",      "low": "C2",  "high": "G#7", "type": "Tenor",          "genre": "Rock/Metal"},
    {"name": "Axl Rose",         "low": "F1",  "high": "B6",  "type": "Tenor",          "genre": "Rock"},
    {"name": "Geoff Tate",       "low": "C3",  "high": "C6",  "type": "Tenor",          "genre": "Progressive Metal"},
    # Gospel / Soul Legends
    {"name": "Mahalia Jackson",  "low": "F3",  "high": "E6",  "type": "Contralto",      "genre": "Gospel"},
    {"name": "Sam Cooke",        "low": "F2",  "high": "C6",  "type": "Tenor",          "genre": "Gospel/Soul"},
    {"name": "Nat King Cole",    "low": "G2",  "high": "G5",  "type": "Baritone",       "genre": "Jazz/Pop"},
    # Afrobeats / African
    {"name": "Burna Boy",        "low": "A2",  "high": "A5",  "type": "Baritone",       "genre": "Afrobeats"},
    {"name": "Wizkid",           "low": "B2",  "high": "B5",  "type": "Tenor",          "genre": "Afrobeats"},
    {"name": "Angelique Kidjo",  "low": "G2",  "high": "C6",  "type": "Mezzo-Soprano",  "genre": "Afropop/World"},
]

def parse_artist_db():
    parsed = []
    for a in ARTISTS:
        low_midi  = note_name_to_midi(a["low"])
        high_midi = note_name_to_midi(a["high"])
        if low_midi is None or high_midi is None:
            continue
        parsed.append({**a, "low_midi": low_midi, "high_midi": high_midi,
                        "semitones": high_midi - low_midi})
    return parsed

ARTIST_DB = parse_artist_db()

def find_similar_artists(user_low, user_high, top_n=5):
    """Find artists whose range overlaps most with user's range."""
    results = []
    user_range = set(range(user_low, user_high + 1))
    for a in ARTIST_DB:
        artist_range = set(range(a["low_midi"], a["high_midi"] + 1))
        overlap = len(user_range & artist_range)
        total   = len(user_range | artist_range)
        score   = overlap / total if total > 0 else 0
        results.append({**a, "similarity": score})
    results.sort(key=lambda x: -x["similarity"])
    return results[:top_n]

# ── PITCH DETECTOR ───────────────────────────────────────────────────────────

class PitchDetector:
    """Wraps aubio pitch detection."""
    def __init__(self, sample_rate=SAMPLE_RATE, buf_size=BUFFER_SIZE):
        import aubio
        self.pitch_o = aubio.pitch("yin", buf_size * 2, buf_size, sample_rate)
        self.pitch_o.set_unit("Hz")
        self.pitch_o.set_tolerance(0.8)

    def detect(self, samples):
        """samples: numpy float32 array of BUFFER_SIZE"""
        freq = self.pitch_o(samples)[0]
        confidence = self.pitch_o.get_confidence()
        return freq, confidence


# ── COLORS ───────────────────────────────────────────────────────────────────

C = {
    "bg":       get_color_from_hex("#0A0E1A"),
    "surface":  get_color_from_hex("#111827"),
    "card":     get_color_from_hex("#1A2235"),
    "accent":   get_color_from_hex("#7C3AED"),
    "accent2":  get_color_from_hex("#A855F7"),
    "gold":     get_color_from_hex("#F59E0B"),
    "teal":     get_color_from_hex("#14B8A6"),
    "rose":     get_color_from_hex("#F43F5E"),
    "text":     get_color_from_hex("#F1F5F9"),
    "muted":    get_color_from_hex("#64748B"),
    "border":   get_color_from_hex("#1E2D45"),
    "green":    get_color_from_hex("#10B981"),
    "note_bg":  get_color_from_hex("#0F172A"),
}


# ── CUSTOM WIDGETS ───────────────────────────────────────────────────────────

class PitchMeter(Widget):
    """Visual waveform / pitch level meter."""
    current_freq = NumericProperty(0)
    current_midi = NumericProperty(0)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.bar_history = deque(maxlen=60)
        self.bind(size=self._draw, pos=self._draw, current_freq=self._on_freq)

    def _on_freq(self, *args):
        midi = freq_to_midi(self.current_freq) if self.current_freq > 0 else 0
        self.current_midi = midi or 0
        norm = max(0, min(1, (self.current_midi - MIDI_C1) / (MIDI_C8 - MIDI_C1))) if self.current_midi else 0
        self.bar_history.append(norm)
        self._draw()

    def _draw(self, *args):
        self.canvas.clear()
        w, h, x, y = self.width, self.height, self.x, self.y
        with self.canvas:
            # Background
            Color(*C["note_bg"])
            RoundedRectangle(pos=(x, y), size=(w, h), radius=[dp(12)])

            # Bar chart of recent pitches
            n = len(self.bar_history)
            if n == 0:
                return
            bar_w = w / 60
            for i, val in enumerate(self.bar_history):
                bh = val * (h - dp(10))
                bx = x + i * bar_w
                # Color by register
                if val < 0.3:
                    Color(0.49, 0.23, 0.93, 0.7)
                elif val < 0.6:
                    Color(0.08, 0.72, 0.65, 0.7)
                else:
                    Color(0.96, 0.25, 0.37, 0.7)
                RoundedRectangle(pos=(bx + 1, y + dp(4)), size=(bar_w - 2, bh),
                                 radius=[dp(2)])

            # Current note line
            if self.current_midi and MIDI_C1 <= self.current_midi <= MIDI_C8:
                norm = (self.current_midi - MIDI_C1) / (MIDI_C8 - MIDI_C1)
                lx = x + norm * w
                Color(*C["gold"], 0.9)
                Line(points=[lx, y + dp(4), lx, y + h - dp(4)], width=dp(2))


class RangeBar(Widget):
    """Horizontal piano-roll style range visualization."""
    low_midi  = NumericProperty(0)
    high_midi = NumericProperty(0)
    tess_low  = NumericProperty(0)
    tess_high = NumericProperty(0)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.bind(size=self._draw, pos=self._draw,
                  low_midi=self._draw, high_midi=self._draw,
                  tess_low=self._draw, tess_high=self._draw)

    def _midi_to_x(self, midi):
        frac = (midi - MIDI_C1) / (MIDI_C8 - MIDI_C1)
        return self.x + frac * self.width

    def _draw(self, *args):
        self.canvas.clear()
        w, h, x, y = self.width, self.height, self.x, self.y
        with self.canvas:
            # Track background
            Color(*C["note_bg"])
            RoundedRectangle(pos=(x, y), size=(w, h), radius=[dp(8)])

            # Draw octave markers
            for octave in range(1, 9):
                midi = (octave + 1) * 12  # C of each octave
                if MIDI_C1 <= midi <= MIDI_C8:
                    ox = self._midi_to_x(midi)
                    Color(*C["border"])
                    Line(points=[ox, y, ox, y + h], width=dp(1))

            if self.low_midi == 0 or self.high_midi == 0:
                return

            # Total range bar
            rx = self._midi_to_x(self.low_midi)
            rw = self._midi_to_x(self.high_midi) - rx
            Color(0.49, 0.23, 0.93, 0.5)
            RoundedRectangle(pos=(rx, y + h * 0.25), size=(rw, h * 0.5), radius=[dp(4)])

            # Tessitura bar
            if self.tess_low and self.tess_high:
                tx = self._midi_to_x(self.tess_low)
                tw = self._midi_to_x(self.tess_high) - tx
                Color(*C["teal"])
                RoundedRectangle(pos=(tx, y + h * 0.3), size=(tw, h * 0.4), radius=[dp(4)])

            # Low marker
            lx = self._midi_to_x(self.low_midi)
            Color(*C["rose"])
            Ellipse(pos=(lx - dp(5), y + h * 0.35), size=(dp(10), h * 0.3))

            # High marker
            hx = self._midi_to_x(self.high_midi)
            Color(*C["gold"])
            Ellipse(pos=(hx - dp(5), y + h * 0.35), size=(dp(10), h * 0.3))


class ArtistRangeBar(Widget):
    """Compact range bar for artist comparison."""
    low_midi    = NumericProperty(0)
    high_midi   = NumericProperty(0)
    user_low    = NumericProperty(0)
    user_high   = NumericProperty(0)
    bar_color   = ListProperty([0.49, 0.23, 0.93, 1])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.bind(size=self._draw, pos=self._draw,
                  low_midi=self._draw, high_midi=self._draw)

    def _midi_to_x(self, midi):
        frac = (midi - MIDI_C1) / (MIDI_C8 - MIDI_C1)
        return self.x + frac * self.width

    def _draw(self, *args):
        self.canvas.clear()
        w, h, x, y = self.width, self.height, self.x, self.y
        with self.canvas:
            Color(*C["note_bg"])
            RoundedRectangle(pos=(x, y), size=(w, h), radius=[dp(4)])

            if self.low_midi == 0 or self.high_midi == 0:
                return

            # Artist bar
            rx = self._midi_to_x(self.low_midi)
            rw = self._midi_to_x(self.high_midi) - rx
            Color(*self.bar_color[:3], 0.7)
            RoundedRectangle(pos=(rx, y + h * 0.2), size=(rw, h * 0.6), radius=[dp(3)])

            # User range overlay
            if self.user_low and self.user_high:
                ux = self._midi_to_x(self.user_low)
                uw = self._midi_to_x(self.user_high) - ux
                Color(*C["gold"], 0.35)
                RoundedRectangle(pos=(ux, y + h * 0.2), size=(uw, h * 0.6), radius=[dp(3)])


# ── SCREENS ──────────────────────────────────────────────────────────────────

class HomeScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._build()

    def _build(self):
        root = FloatLayout()
        with root.canvas.before:
            Color(*C["bg"])
            self._bg_rect = Rectangle(pos=root.pos, size=root.size)
        root.bind(pos=lambda i, v: setattr(self._bg_rect, 'pos', v),
                  size=lambda i, v: setattr(self._bg_rect, 'size', v))

        # Center column
        col = BoxLayout(orientation='vertical', padding=dp(32), spacing=dp(20),
                        size_hint=(0.88, None), pos_hint={'center_x': 0.5, 'center_y': 0.5})
        col.bind(minimum_height=col.setter('height'))

        # Logo
        logo = Label(
            text="[b]VOX[color=7C3AED]SCOPE[/color][/b]",
            markup=True, font_size=sp(42),
            size_hint_y=None, height=dp(60), color=C["text"])
        col.add_widget(logo)

        tagline = Label(
            text="[i]Discover your voice. Find your range.[/i]",
            markup=True, font_size=sp(14),
            size_hint_y=None, height=dp(30), color=C["muted"])
        col.add_widget(tagline)

        col.add_widget(Widget(size_hint_y=None, height=dp(30)))

        # Feature pills
        features = [
            ("🎤", "Record & Detect", "Pitch-accurate via microphone"),
            ("📊", "Full Analysis",   "Range, semitones, tessitura"),
            ("🎵", "Artist Compare",  "Match with 35+ global artists"),
        ]
        for icon, title, desc in features:
            row = BoxLayout(orientation='horizontal', spacing=dp(16),
                            size_hint_y=None, height=dp(64))
            icon_lbl = Label(text=icon, font_size=sp(26),
                             size_hint_x=None, width=dp(48))
            info = BoxLayout(orientation='vertical')
            info.add_widget(Label(text=f"[b]{title}[/b]", markup=True,
                                  font_size=sp(14), color=C["text"],
                                  halign='left', valign='middle',
                                  size_hint_y=0.5))
            info.add_widget(Label(text=desc, font_size=sp(12),
                                  color=C["muted"], halign='left',
                                  valign='middle', size_hint_y=0.5))
            for lbl in info.children:
                lbl.bind(size=lbl.setter('text_size'))
            row.add_widget(icon_lbl)
            row.add_widget(info)
            col.add_widget(row)

        col.add_widget(Widget(size_hint_y=None, height=dp(20)))

        # Start button
        btn = Button(
            text="[b]START ANALYSIS[/b]", markup=True,
            font_size=sp(16),
            size_hint_y=None, height=dp(56),
            background_normal='', background_color=C["accent"],
            color=C["text"])
        btn.bind(on_release=self._go_record)
        col.add_widget(btn)

        # Artists button
        btn2 = Button(
            text="Browse Artist Ranges",
            font_size=sp(14),
            size_hint_y=None, height=dp(44),
            background_normal='', background_color=C["card"],
            color=C["muted"])
        btn2.bind(on_release=self._go_artists)
        col.add_widget(btn2)

        root.add_widget(col)
        self.add_widget(root)

    def _go_record(self, *args):
        self.manager.current = 'record'

    def _go_artists(self, *args):
        self.manager.get_screen('results').show_artist_only = True
        self.manager.current = 'results'


class RecordScreen(Screen):
    recording      = BooleanProperty(False)
    elapsed        = NumericProperty(0)
    current_note   = StringProperty("—")
    current_freq   = NumericProperty(0)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._detected_notes = []
        self._note_counts    = {}
        self._thread         = None
        self._stop_flag      = threading.Event()
        self._detector       = None
        self._build()

    def _build(self):
        root = FloatLayout()
        with root.canvas.before:
            Color(*C["bg"])
            self._bg = Rectangle(pos=root.pos, size=root.size)
        root.bind(pos=lambda i, v: setattr(self._bg, 'pos', v),
                  size=lambda i, v: setattr(self._bg, 'size', v))

        col = BoxLayout(orientation='vertical', padding=dp(24), spacing=dp(16),
                        size_hint=(0.92, 0.95), pos_hint={'center_x': 0.5, 'center_y': 0.5})

        # Header
        hdr = BoxLayout(size_hint_y=None, height=dp(50))
        back_btn = Button(text="← Back", size_hint_x=None, width=dp(80),
                          background_normal='', background_color=(0,0,0,0),
                          color=C["muted"], font_size=sp(13))
        back_btn.bind(on_release=self._go_back)
        title = Label(text="[b]Record Your Voice[/b]", markup=True,
                      font_size=sp(18), color=C["text"])
        hdr.add_widget(back_btn)
        hdr.add_widget(title)
        col.add_widget(hdr)

        # Instruction
        self.instr_lbl = Label(
            text="Sing sustained notes across your full range.\nStart LOW, end HIGH.",
            font_size=sp(13), color=C["muted"],
            halign='center', size_hint_y=None, height=dp(44))
        self.instr_lbl.bind(size=self.instr_lbl.setter('text_size'))
        col.add_widget(self.instr_lbl)

        # Big note display
        note_card = BoxLayout(orientation='vertical', spacing=dp(4),
                              size_hint_y=None, height=dp(130))
        with note_card.canvas.before:
            Color(*C["card"])
            self._note_card_bg = RoundedRectangle(pos=note_card.pos,
                                                   size=note_card.size, radius=[dp(16)])
        note_card.bind(pos=lambda i, v: setattr(self._note_card_bg, 'pos', v),
                       size=lambda i, v: setattr(self._note_card_bg, 'size', v))

        self.note_lbl = Label(text="—", font_size=sp(52), color=C["accent2"],
                              bold=True, size_hint_y=0.7)
        self.freq_lbl = Label(text="0.0 Hz", font_size=sp(13),
                              color=C["muted"], size_hint_y=0.3)
        note_card.add_widget(self.note_lbl)
        note_card.add_widget(self.freq_lbl)
        col.add_widget(note_card)

        # Pitch meter
        self.pitch_meter = PitchMeter(size_hint_y=None, height=dp(100))
        col.add_widget(self.pitch_meter)

        # Timer + counter
        stats_row = BoxLayout(size_hint_y=None, height=dp(44), spacing=dp(16))
        self.timer_lbl = Label(text="0.0s", font_size=sp(22),
                               color=C["gold"], bold=True)
        self.note_count_lbl = Label(text="Notes detected: 0",
                                    font_size=sp(13), color=C["muted"])
        stats_row.add_widget(self.timer_lbl)
        stats_row.add_widget(self.note_count_lbl)
        col.add_widget(stats_row)

        # Progress bar
        self.prog_outer = Widget(size_hint_y=None, height=dp(8))
        self.prog_outer.bind(size=self._draw_progress, pos=self._draw_progress)
        self._prog_val = 0
        col.add_widget(self.prog_outer)

        col.add_widget(Widget())  # spacer

        # Control buttons
        self.record_btn = Button(
            text="[b]🎤  START RECORDING[/b]", markup=True,
            font_size=sp(15), size_hint_y=None, height=dp(56),
            background_normal='', background_color=C["rose"],
            color=C["text"])
        self.record_btn.bind(on_release=self._toggle_record)
        col.add_widget(self.record_btn)

        self.analyze_btn = Button(
            text="ANALYZE RESULTS →", font_size=sp(14),
            size_hint_y=None, height=dp(44),
            background_normal='', background_color=C["card"],
            color=C["muted"], disabled=True)
        self.analyze_btn.bind(on_release=self._go_analyze)
        col.add_widget(self.analyze_btn)

        root.add_widget(col)
        self.add_widget(root)

    def _draw_progress(self, *args):
        self.prog_outer.canvas.clear()
        w, h = self.prog_outer.width, self.prog_outer.height
        x, y = self.prog_outer.x, self.prog_outer.y
        with self.prog_outer.canvas:
            Color(*C["card"])
            RoundedRectangle(pos=(x, y), size=(w, h), radius=[dp(4)])
            Color(*C["accent"])
            RoundedRectangle(pos=(x, y), size=(w * self._prog_val, h), radius=[dp(4)])

    def _toggle_record(self, *args):
        if not self.recording:
            self._start_recording()
        else:
            self._stop_recording()

    def _start_recording(self):
        self.recording = True
        self._detected_notes.clear()
        self._note_counts.clear()
        self.elapsed = 0
        self._prog_val = 0
        self.record_btn.text = "[b]⏹  STOP RECORDING[/b]"
        self.record_btn.background_color = C["muted"]
        self.analyze_btn.disabled = True

        self._stop_flag.clear()
        self._thread = threading.Thread(target=self._record_loop, daemon=True)
        self._thread.start()
        Clock.schedule_interval(self._update_ui, 0.1)

    def _stop_recording(self):
        self._stop_flag.set()
        self.recording = False
        Clock.unschedule(self._update_ui)
        self.record_btn.text = "[b]🎤  START RECORDING[/b]"
        self.record_btn.background_color = C["rose"]
        if len(self._detected_notes) >= 5:
            self.analyze_btn.disabled = False

    def _record_loop(self):
        try:
            import sounddevice as sd
            detector = PitchDetector(SAMPLE_RATE, BUFFER_SIZE)
            start = time.time()

            def callback(indata, frames, time_info, status):
                if self._stop_flag.is_set():
                    raise sd.CallbackStop
                samples = indata[:, 0].astype(np.float32)
                freq, conf = detector.detect(samples)
                if conf > 0.85 and 60 < freq < 2100:
                    midi = freq_to_midi(freq)
                    if midi and MIDI_C1 <= midi <= MIDI_C8:
                        self._detected_notes.append(midi)
                        self._note_counts[midi] = self._note_counts.get(midi, 0) + 1
                        Clock.schedule_once(lambda dt, f=freq, m=midi: self._set_note(f, m))
                else:
                    Clock.schedule_once(lambda dt: self._set_note(0, 0))

                elapsed = time.time() - start
                if elapsed >= RECORD_SECONDS:
                    raise sd.CallbackStop

            with sd.InputStream(samplerate=SAMPLE_RATE, channels=1,
                                blocksize=BUFFER_SIZE, dtype='float32',
                                callback=callback):
                while not self._stop_flag.is_set():
                    time.sleep(0.05)

        except Exception as e:
            print(f"Record error: {e}")
        finally:
            Clock.schedule_once(lambda dt: self._stop_recording())

    def _set_note(self, freq, midi):
        self.current_freq = freq
        self.pitch_meter.current_freq = freq
        if midi and freq > 0:
            self.note_lbl.text = midi_to_note_name(midi)
            self.freq_lbl.text = f"{freq:.1f} Hz"
        else:
            self.note_lbl.text = "—"
            self.freq_lbl.text = "0.0 Hz"

    def _update_ui(self, dt):
        self.elapsed += dt
        self.timer_lbl.text = f"{self.elapsed:.1f}s"
        self.note_count_lbl.text = f"Notes detected: {len(self._detected_notes)}"
        self._prog_val = min(1, self.elapsed / RECORD_SECONDS)
        self._draw_progress()
        if self.elapsed >= RECORD_SECONDS:
            self._stop_recording()

    def _go_back(self, *args):
        self._stop_flag.set()
        self.manager.current = 'home'

    def _go_analyze(self, *args):
        if not self._detected_notes:
            return
        results_screen = self.manager.get_screen('results')
        results_screen.load_data(self._detected_notes, self._note_counts)
        self.manager.current = 'results'


class ResultsScreen(Screen):
    show_artist_only = BooleanProperty(False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.low_midi  = 0
        self.high_midi = 0
        self.tess_low  = 0
        self.tess_high = 0
        self._build()

    def _build(self):
        root = FloatLayout()
        with root.canvas.before:
            Color(*C["bg"])
            self._bg = Rectangle(pos=root.pos, size=root.size)
        root.bind(pos=lambda i, v: setattr(self._bg, 'pos', v),
                  size=lambda i, v: setattr(self._bg, 'size', v))

        outer = BoxLayout(orientation='vertical', padding=dp(16), spacing=dp(10),
                          size_hint=(0.95, 0.97), pos_hint={'center_x': 0.5, 'center_y': 0.5})

        # Header
        hdr = BoxLayout(size_hint_y=None, height=dp(48))
        back_btn = Button(text="← Back", size_hint_x=None, width=dp(80),
                          background_normal='', background_color=(0,0,0,0),
                          color=C["muted"], font_size=sp(13))
        back_btn.bind(on_release=self._go_back)
        self.title_lbl = Label(text="[b]Your Vocal Analysis[/b]", markup=True,
                               font_size=sp(18), color=C["text"])
        hdr.add_widget(back_btn)
        hdr.add_widget(self.title_lbl)
        outer.add_widget(hdr)

        scroll = ScrollView(size_hint_y=1)
        self.content = BoxLayout(orientation='vertical', spacing=dp(12),
                                 size_hint_y=None, padding=[0, dp(4), 0, dp(16)])
        self.content.bind(minimum_height=self.content.setter('height'))
        scroll.add_widget(self.content)
        outer.add_widget(scroll)

        root.add_widget(outer)
        self.add_widget(root)

    def on_pre_enter(self, *args):
        if self.show_artist_only:
            self.show_artist_only = False
            self.title_lbl.text = "[b]Artist Vocal Ranges[/b]"
            self._show_all_artists()

    def load_data(self, notes, note_counts):
        if not notes:
            return
        self.low_midi  = min(notes)
        self.high_midi = max(notes)
        self.tess_low, self.tess_high = estimate_tessitura(note_counts)
        self.title_lbl.text = "[b]Your Vocal Analysis[/b]"
        self._render_results(notes, note_counts)

    def _render_results(self, notes, note_counts):
        self.content.clear_widgets()
        low, high = self.low_midi, self.high_midi
        semitones  = high - low
        voice_type = classify_voice_type(low, high)
        similar    = find_similar_artists(low, high)

        # ── STAT CARDS ROW ──
        stats = [
            ("Lowest Note",  midi_to_note_name(low),          C["rose"]),
            ("Highest Note", midi_to_note_name(high),         C["gold"]),
            ("Semitones",    str(semitones),                   C["teal"]),
            ("Voice Type",   voice_type,                       C["accent2"]),
        ]
        grid = GridLayout(cols=2, spacing=dp(8), size_hint_y=None, height=dp(130))
        for label, val, color in stats:
            card = self._stat_card(label, val, color)
            grid.add_widget(card)
        self.content.add_widget(grid)

        # ── TESSITURA ──
        if self.tess_low and self.tess_high:
            tess_card = self._section_card("🎯  Tessitura (Comfortable Range)")
            tbox = BoxLayout(orientation='vertical', spacing=dp(6),
                             size_hint_y=None, height=dp(70))
            trow = BoxLayout(size_hint_y=None, height=dp(24))
            trow.add_widget(Label(
                text=f"[b]{midi_to_note_name(self.tess_low)}[/b]  →  [b]{midi_to_note_name(self.tess_high)}[/b]",
                markup=True, font_size=sp(16), color=C["teal"]))
            tbox.add_widget(trow)
            rbar = RangeBar(low_midi=low, high_midi=high,
                            tess_low=self.tess_low, tess_high=self.tess_high,
                            size_hint_y=None, height=dp(36))
            tbox.add_widget(rbar)
            tess_card.add_widget(tbox)
            self.content.add_widget(tess_card)

        # ── RANGE LEGEND ──
        leg_card = self._section_card("📏  Full Range Details")
        details = [
            ("Total Range",    f"{midi_to_note_name(low)} — {midi_to_note_name(high)}"),
            ("Semitones",      f"{semitones}  ({semitones/12:.1f} octaves)"),
            ("Tessitura",      f"{midi_to_note_name(self.tess_low)} — {midi_to_note_name(self.tess_high)}" if self.tess_low else "N/A"),
            ("Voice Category", voice_type),
        ]
        for k, v in details:
            row = BoxLayout(size_hint_y=None, height=dp(28))
            row.add_widget(Label(text=k, font_size=sp(13), color=C["muted"],
                                 halign='left', size_hint_x=0.45))
            row.add_widget(Label(text=f"[b]{v}[/b]", markup=True,
                                 font_size=sp(13), color=C["text"],
                                 halign='left', size_hint_x=0.55))
            for lbl in row.children:
                lbl.bind(size=lbl.setter('text_size'))
            leg_card.add_widget(row)
        self.content.add_widget(leg_card)

        # ── SIMILAR ARTISTS ──
        art_card = self._section_card("🎵  Artists With Similar Range")
        colors = [C["accent"], C["teal"], C["rose"], C["gold"], C["green"]]
        for i, a in enumerate(similar):
            pct = int(a["similarity"] * 100)
            col_color = colors[i % len(colors)]
            arow = BoxLayout(orientation='vertical', size_hint_y=None,
                             height=dp(62), spacing=dp(2))
            top = BoxLayout(size_hint_y=None, height=dp(24))
            top.add_widget(Label(
                text=f"[b]{a['name']}[/b]  [color=64748B]{a['type']}  •  {a['genre']}[/color]",
                markup=True, font_size=sp(12), color=C["text"],
                halign='left', size_hint_x=0.75))
            top.add_widget(Label(
                text=f"[b]{pct}%[/b] match", markup=True,
                font_size=sp(12), color=col_color,
                halign='right', size_hint_x=0.25))
            for lbl in top.children:
                lbl.bind(size=lbl.setter('text_size'))
            arow.add_widget(top)

            sub = Label(
                text=f"{a['low']} — {a['high']}  ({a['semitones']} semitones)",
                font_size=sp(11), color=C["muted"],
                halign='left', size_hint_y=None, height=dp(16))
            sub.bind(size=sub.setter('text_size'))
            arow.add_widget(sub)

            abar = ArtistRangeBar(
                low_midi=a["low_midi"], high_midi=a["high_midi"],
                user_low=low, user_high=high,
                bar_color=list(col_color[:3]) + [1],
                size_hint_y=None, height=dp(16))
            arow.add_widget(abar)
            art_card.add_widget(arow)

        # Octave legend under artist bars
        leg_row = BoxLayout(size_hint_y=None, height=dp(14))
        for o in range(1, 9):
            leg_row.add_widget(Label(text=f"C{o}", font_size=sp(9),
                                     color=C["muted"]))
        art_card.add_widget(leg_row)
        self.content.add_widget(art_card)

        # ── ALL ARTISTS MINI ──
        all_card = self._section_card("📋  All Artists Reference")
        for a in sorted(ARTIST_DB, key=lambda x: x["low_midi"]):
            mini_row = BoxLayout(size_hint_y=None, height=dp(18))
            mini_row.add_widget(Label(
                text=a["name"], font_size=sp(10), color=C["muted"],
                size_hint_x=0.35, halign='left'))
            mini_row.add_widget(Label(
                text=f"{a['low']}—{a['high']}", font_size=sp(10),
                color=C["text"], size_hint_x=0.2, halign='center'))
            mini_bar = ArtistRangeBar(
                low_midi=a["low_midi"], high_midi=a["high_midi"],
                user_low=low, user_high=high,
                bar_color=list(C["accent"][:3]) + [1],
                size_hint_x=0.45, size_hint_y=1)
            mini_row.add_widget(mini_bar)
            for lbl in mini_row.children:
                if hasattr(lbl, 'text_size'):
                    lbl.bind(size=lbl.setter('text_size'))
            all_card.add_widget(mini_row)
        self.content.add_widget(all_card)

    def _show_all_artists(self):
        self.content.clear_widgets()
        all_card = self._section_card("🎵  All Artist Vocal Ranges (C1–C8)")
        for a in sorted(ARTIST_DB, key=lambda x: x["low_midi"]):
            row = BoxLayout(size_hint_y=None, height=dp(44), spacing=dp(6))
            info = BoxLayout(orientation='vertical', size_hint_x=0.38)
            info.add_widget(Label(text=f"[b]{a['name']}[/b]", markup=True,
                                  font_size=sp(11), color=C["text"],
                                  halign='left', size_hint_y=0.55))
            info.add_widget(Label(text=a["type"], font_size=sp(10),
                                  color=C["muted"], halign='left', size_hint_y=0.45))
            for lbl in info.children:
                lbl.bind(size=lbl.setter('text_size'))
            range_lbl = Label(text=f"{a['low']}–{a['high']}",
                              font_size=sp(10), color=C["teal"],
                              size_hint_x=0.18, halign='center')
            bar = ArtistRangeBar(
                low_midi=a["low_midi"], high_midi=a["high_midi"],
                bar_color=list(C["accent"][:3]) + [1],
                size_hint_x=0.44)
            row.add_widget(info)
            row.add_widget(range_lbl)
            row.add_widget(bar)
            all_card.add_widget(row)
        self.content.add_widget(all_card)

    def _stat_card(self, label, value, color):
        card = BoxLayout(orientation='vertical', spacing=dp(2),
                         size_hint_y=None, height=dp(60))
        with card.canvas.before:
            Color(*C["card"])
            bg = RoundedRectangle(pos=card.pos, size=card.size, radius=[dp(12)])
        card.bind(pos=lambda i, v: setattr(bg, 'pos', v),
                  size=lambda i, v: setattr(bg, 'size', v))
        card.add_widget(Label(text=label, font_size=sp(10),
                              color=C["muted"], size_hint_y=0.4))
        card.add_widget(Label(text=f"[b]{value}[/b]", markup=True,
                              font_size=sp(16), color=color, size_hint_y=0.6))
        return card

    def _section_card(self, title):
        card = BoxLayout(orientation='vertical', spacing=dp(8),
                         size_hint_y=None, padding=dp(14))
        card.bind(minimum_height=card.setter('height'))
        with card.canvas.before:
            Color(*C["card"])
            bg = RoundedRectangle(pos=card.pos, size=card.size, radius=[dp(14)])
        card.bind(pos=lambda i, v: setattr(bg, 'pos', v),
                  size=lambda i, v: setattr(bg, 'size', v))
        card.add_widget(Label(text=f"[b]{title}[/b]", markup=True,
                              font_size=sp(13), color=C["text"],
                              size_hint_y=None, height=dp(26),
                              halign='left'))
        return card

    def _go_back(self, *args):
        self.manager.current = 'home'


# ── APP ───────────────────────────────────────────────────────────────────────

class VoxScopeApp(App):
    def build(self):
        Window.clearcolor = C["bg"]
        sm = ScreenManager(transition=FadeTransition(duration=0.25))
        sm.add_widget(HomeScreen(name='home'))
        sm.add_widget(RecordScreen(name='record'))
        sm.add_widget(ResultsScreen(name='results'))
        return sm


if __name__ == '__main__':
    VoxScopeApp().run()
