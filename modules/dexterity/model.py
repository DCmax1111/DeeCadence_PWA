from datetime import date as dt
import math


MIDI_TO_NOTE = {}
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F',
              'F#', 'G', 'G#', 'A', 'A#', 'B']

for midi in range(0, 128):
    octave = (midi // 12) - 1
    name = NOTE_NAMES[midi % 12]
    MIDI_TO_NOTE[midi] = f"{name}{octave}"

NOTE_TO_MIDI = {v: k for k, v in MIDI_TO_NOTE.items()}


def midi_to_note(midi): return MIDI_TO_NOTE.get(int(midi), "?")
def note_to_midi(note): return NOTE_TO_MIDI.get(note, 0)


RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S', 'SS']

TITLE_THRESHOLDS = [
    (60, "Boundless"),
    (50, "Expansive"),
    (40, "Wide"),
    (30, "Extended"),
    (20, "Solid"),
    (0,  "Narrow"),
]

VOICE_TYPE_RANGES = [
    ("Bass",         36, 60),
    ("Bass-Baritone",38, 62),
    ("Baritone",     40, 65),
    ("Tenor",        43, 69),
    ("Countertenor", 48, 72),
    ("Contralto",    41, 65),
    ("Mezzo-Soprano",45, 69),
    ("Soprano",      48, 74),
]


def xp_to_next_level(level):
    return 50 * (level ** 2)


def level_from_xp(total_xp):
    level = 1
    remaining = total_xp
    while True:
        needed = xp_to_next_level(level)
        if remaining < needed:
            break
        remaining -= needed
        level += 1
    return level, remaining


class DexterityModel:
    def __init__(self, db):
        self.db = db
        self._ensure_tables()

    def _ensure_tables(self):
        # Original dexterity table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS dexterity_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                type       TEXT NOT NULL,
                duration   INTEGER NOT NULL,
                note       TEXT,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self._ensure_vocal_tables()

    def _ensure_vocal_tables(self):
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS vocal_sessions (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                session_type   TEXT NOT NULL,
                low_note       TEXT,
                high_note      TEXT,
                low_midi       INTEGER,
                high_midi      INTEGER,
                semitones      INTEGER,
                tess_low       INTEGER,
                tess_high      INTEGER,
                voice_type     TEXT,
                peak_duration  REAL,
                cold_to_peak   REAL,
                exercise_name  TEXT,
                accuracy_score REAL,
                date           TEXT NOT NULL,
                created_at     TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS vocal_xp_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                xp_earned    INTEGER NOT NULL,
                reason       TEXT NOT NULL,
                session_type TEXT,
                date         TEXT NOT NULL,
                created_at   TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS vocal_milestones (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                milestone   TEXT UNIQUE NOT NULL,
                achieved_at TEXT DEFAULT (datetime('now'))
            )
        """)

    # ── Original dexterity methods ────────────────────────────────

    def log_session(self, type_, duration, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO dexterity_log
               (type, duration, note, date)
               VALUES (?,?,?,?)""",
            (type_, duration, note, date))
        self._update_dexterity_stat()

    def get_sessions(self, limit=10):
        return self.db.fetchall(
            """SELECT * FROM dexterity_log
               ORDER BY date DESC LIMIT ?""", (limit,))

    def delete_session(self, id_):
        self.db.execute(
            "DELETE FROM dexterity_log WHERE id=?", (id_,))
        self._update_dexterity_stat()

    def _update_dexterity_stat(self):
        row = self.db.fetchone(
            """SELECT COUNT(*) as sessions,
               COALESCE(SUM(duration),0) as total_mins
               FROM dexterity_log
               WHERE date >= date('now','-7 days')""")
        sessions = row["sessions"] if row else 0
        total = row["total_mins"] if row else 0
        session_score = min(50, sessions * 10)
        time_score = min(50, (total / 300) * 50)
        value = min(100, session_score + time_score)
        from shared.theme import get_rank
        self.db.execute(
            """UPDATE stats SET value=?, rank=?
               WHERE name='Dexterity'""",
            (value, get_rank(value)))

    # ── Vocal session methods ─────────────────────────────────────

    def log_vocal_session(self, session_type, low_note, high_note,
                          low_midi, high_midi, semitones,
                          tess_low, tess_high, voice_type,
                          peak_duration, cold_to_peak,
                          exercise_name=None, accuracy_score=None):
        today = dt.today().isoformat()
        self.db.execute(
            """INSERT INTO vocal_sessions (
                session_type, low_note, high_note,
                low_midi, high_midi, semitones,
                tess_low, tess_high, voice_type,
                peak_duration, cold_to_peak,
                exercise_name, accuracy_score, date
               ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (session_type, low_note, high_note,
             low_midi, high_midi, semitones,
             tess_low, tess_high, voice_type,
             peak_duration, cold_to_peak,
             exercise_name, accuracy_score, today))

    def get_vocal_sessions(self, limit=10, session_type=None):
        if session_type:
            return self.db.fetchall(
                """SELECT * FROM vocal_sessions
                   WHERE session_type=?
                   ORDER BY date DESC LIMIT ?""",
                (session_type, limit))
        return self.db.fetchall(
            """SELECT * FROM vocal_sessions
               ORDER BY date DESC LIMIT ?""", (limit,))

    def get_vocal_best(self):
        best = self.db.fetchone(
            """SELECT
               MAX(high_midi) as best_high,
               MIN(low_midi)  as best_low,
               MAX(semitones) as best_semitones,
               MIN(tess_low)  as best_tess_low,
               MAX(tess_high) as best_tess_high
               FROM vocal_sessions
               WHERE session_type='performance'""")

        # Starting tessitura from first 3 sessions
        first_three = self.db.fetchall(
            """SELECT tess_low, tess_high FROM vocal_sessions
               WHERE session_type='performance'
               ORDER BY date ASC LIMIT 3""")
        if first_three:
            start_tl = min(r["tess_low"] for r in first_three
                           if r["tess_low"])
            start_th = max(r["tess_high"] for r in first_three
                           if r["tess_high"])
        else:
            start_tl = start_th = None

        return {
            "best_high":      best["best_high"] if best else None,
            "best_low":       best["best_low"] if best else None,
            "best_semitones": best["best_semitones"] if best else None,
            "best_tess_low":  best["best_tess_low"] if best else None,
            "best_tess_high": best["best_tess_high"] if best else None,
            "start_tess_low": start_tl,
            "start_tess_high": start_th,
        }

    def get_last_performance_session(self):
        row = self.db.fetchone(
            """SELECT * FROM vocal_sessions
               WHERE session_type='performance'
               ORDER BY date DESC, id DESC LIMIT 1""")
        return dict(row) if row else None

    def get_last_n_performance_sessions(self, n):
        rows = self.db.fetchall(
            """SELECT * FROM vocal_sessions
               WHERE session_type='performance'
               ORDER BY date DESC, id DESC LIMIT ?""", (n,))
        return [dict(r) for r in rows]

    def get_warmup_best(self, exercise_name):
        row = self.db.fetchone(
            """SELECT MAX(accuracy_score) as best
               FROM vocal_sessions
               WHERE session_type='warmup'
               AND exercise_name=?""", (exercise_name,))
        return row["best"] if row and row["best"] else None

    def get_total_vocal_xp(self):
        row = self.db.fetchone(
            "SELECT COALESCE(SUM(xp_earned),0) as total FROM vocal_xp_log")
        return row["total"] if row else 0

    def get_vocal_level(self):
        total = self.get_total_vocal_xp()
        level, _ = level_from_xp(total)
        return level

    def get_xp_to_next_level(self):
        total = self.get_total_vocal_xp()
        level, remainder = level_from_xp(total)
        needed = xp_to_next_level(level)
        return level, remainder, needed

    def get_vocal_rank(self):
        sessions = self.get_last_n_performance_sessions(10)
        n = len(sessions)

        if n < 3:
            return "E"

        best = self.get_vocal_best()

        # Rank D — tessitura established across 3 sessions
        if n >= 3:
            tess_sessions = [s for s in sessions[:3]
                             if s.get("tess_low") and s.get("tess_high")]
            if len(tess_sessions) < 3:
                return "D"
            current_rank = "D"
        else:
            return "E"

        # Rank C — no regression in last 5 performance sessions
        if n >= 5:
            last5 = sessions[:5]
            ceilings = [s["high_midi"] for s in last5 if s.get("high_midi")]
            if len(ceilings) >= 5 and ceilings == sorted(ceilings, reverse=True):
                current_rank = "C"
            elif len(ceilings) >= 5:
                # Check no regression — each ceiling >= previous
                no_regress = all(
                    ceilings[i] >= ceilings[i+1]
                    for i in range(len(ceilings)-1))
                if no_regress:
                    current_rank = "C"

        # Rank B — cold-to-peak improving across last 5 sessions
        if current_rank in ("C",):
            if n >= 5:
                last5 = sessions[:5]
                ctps = [s["cold_to_peak"] for s in last5
                        if s.get("cold_to_peak") is not None]
                if len(ctps) >= 5:
                    improving = all(
                        ctps[i] <= ctps[i+1]
                        for i in range(len(ctps)-1))
                    if improving:
                        current_rank = "B"

        # Rank A — tessitura expanded 6+ semitones from start
        if current_rank in ("C", "B"):
            if (best["start_tess_low"] and best["best_tess_low"] and
                    best["start_tess_high"] and best["best_tess_high"]):
                start_width = (best["start_tess_high"] -
                               best["start_tess_low"])
                current_width = (best["best_tess_high"] -
                                 best["best_tess_low"])
                if current_width - start_width >= 6:
                    current_rank = "A"

        # Rank S — 60+ semitones + consistent tessitura
        if current_rank in ("B", "A"):
            if best["best_semitones"] and best["best_semitones"] >= 60:
                last3_tess = sessions[:3]
                tess_consistent = all(
                    abs(s["tess_low"] - last3_tess[0]["tess_low"]) <= 2 and
                    abs(s["tess_high"] - last3_tess[0]["tess_high"]) <= 2
                    for s in last3_tess
                    if s.get("tess_low") and s.get("tess_high"))
                if tess_consistent:
                    current_rank = "S"

        # Rank SS — all above + peak held 2s+ consistently across 10 sessions
        if current_rank == "S":
            if n >= 10:
                peak_held = [s for s in sessions
                             if s.get("peak_duration") and
                             s["peak_duration"] >= 2.0]
                if len(peak_held) >= 10:
                    current_rank = "SS"

        return current_rank

    def get_voice_type(self):
        rows = self.db.fetchall(
            """SELECT tess_low, tess_high FROM vocal_sessions
               WHERE session_type='performance'
               AND tess_low IS NOT NULL
               AND tess_high IS NOT NULL
               ORDER BY date DESC LIMIT 3""")
        if not rows:
            return "Unknown"
        midpoints = [(r["tess_low"] + r["tess_high"]) / 2
                     for r in rows]
        avg_mid = sum(midpoints) / len(midpoints)
        best_type = "Unknown"
        best_diff = float('inf')
        for vtype, low, high in VOICE_TYPE_RANGES:
            mid = (low + high) / 2
            diff = abs(avg_mid - mid)
            if diff < best_diff:
                best_diff = diff
                best_type = vtype
        return best_type

    def get_vocal_title(self):
        best = self.get_vocal_best()
        semitones = best["best_semitones"] or 0
        for threshold, title in TITLE_THRESHOLDS:
            if semitones >= threshold:
                return title
        return "Narrow"

    def add_vocal_xp(self, xp, reason, session_type):
        today = dt.today().isoformat()
        self.db.execute(
            """INSERT INTO vocal_xp_log
               (xp_earned, reason, session_type, date)
               VALUES (?,?,?,?)""",
            (xp, reason, session_type, today))

    def check_and_award_xp(self, session):
        awarded = []
        stype = session.get("session_type", "performance")

        if stype == "warmup":
            ex = session.get("exercise_name")
            acc = session.get("accuracy_score", 0)
            if ex:
                prev_best = self.get_warmup_best(ex)
                mk = f"warmup_best:{ex}:{round(acc, 2)}"
                if ((prev_best is None or acc > prev_best) and
                        not self.milestone_exists(mk)):
                    self.add_vocal_xp(20, f"Warmup PB: {ex}", stype)
                    self.log_milestone(mk)
                    awarded.append((20, f"Warmup personal best: {ex}"))
            return awarded

        # Performance XP checks
        best = self.get_vocal_best()
        last = self.get_last_performance_session()
        last5 = self.get_last_n_performance_sessions(5)

        high_midi = session.get("high_midi")
        low_midi = session.get("low_midi")
        semitones = session.get("semitones", 0)
        peak_dur = session.get("peak_duration", 0)
        cold_to_peak = session.get("cold_to_peak")
        tess_low = session.get("tess_low")
        tess_high = session.get("tess_high")
        high_note = session.get("high_note", "")
        low_note = session.get("low_note", "")

        # +30 New highest note held 2+ seconds
        if (high_midi and peak_dur and peak_dur >= 2.0):
            prev_best_high = best["best_high"]
            if (prev_best_high is None or
                    high_midi > prev_best_high):
                mk = f"highest_note:{high_note}"
                if not self.milestone_exists(mk):
                    self.add_vocal_xp(
                        30, f"New highest note: {high_note}", stype)
                    self.log_milestone(mk)
                    awarded.append(
                        (30, f"New highest note held 2s+: {high_note}"))

        # +20 New lowest note held 2+ seconds
        if low_midi and peak_dur and peak_dur >= 2.0:
            prev_best_low = best["best_low"]
            if (prev_best_low is None or
                    low_midi < prev_best_low):
                mk = f"lowest_note:{low_note}"
                if not self.milestone_exists(mk):
                    self.add_vocal_xp(
                        20, f"New lowest note: {low_note}", stype)
                    self.log_milestone(mk)
                    awarded.append(
                        (20, f"New lowest note held 2s+: {low_note}"))

        # +25 Tessitura expands 2+ semitones vs personal best
        if tess_low and tess_high:
            prev_tl = best["best_tess_low"]
            prev_th = best["best_tess_high"]
            if prev_tl and prev_th:
                prev_width = prev_th - prev_tl
                new_width = tess_high - tess_low
                if new_width - prev_width >= 2:
                    mk = f"tess_expand:{new_width}"
                    if not self.milestone_exists(mk):
                        self.add_vocal_xp(
                            25, "Tessitura expanded 2+ semitones", stype)
                        self.log_milestone(mk)
                        awarded.append(
                            (25, "Tessitura expanded 2+ semitones"))

        # +15 No regression — ceiling matches or exceeds previous session
        if last and high_midi:
            prev_ceil = last.get("high_midi")
            if prev_ceil and high_midi >= prev_ceil:
                mk = f"no_regress:{dt.today().isoformat()}"
                if not self.milestone_exists(mk):
                    self.add_vocal_xp(
                        15, "No regression this session", stype)
                    self.log_milestone(mk)
                    awarded.append(
                        (15, "Ceiling maintained — no regression"))

        # +40 Note hit in 3 consecutive sessions
        if high_note and len(last5) >= 2:
            prev_highs = [s.get("high_note") for s in last5[:2]]
            if all(h == high_note for h in prev_highs):
                mk = f"consistency:{high_note}"
                if not self.milestone_exists(mk):
                    self.add_vocal_xp(
                        40, f"Consistency: {high_note} x3", stype)
                    self.log_milestone(mk)
                    awarded.append(
                        (40, f"Consistency confirmed: {high_note} x3 sessions"))

        # +50 Cold-to-peak improves vs previous session's ceiling
        if (cold_to_peak is not None and last and
                last.get("cold_to_peak") is not None and
                last.get("high_midi") == high_midi):
            if cold_to_peak < last["cold_to_peak"]:
                mk = f"cold_to_peak:{high_note}:{round(cold_to_peak,1)}"
                if not self.milestone_exists(mk):
                    self.add_vocal_xp(
                        50, f"Cold-to-peak improved: {high_note}", stype)
                    self.log_milestone(mk)
                    awarded.append(
                        (50, f"Cold-to-peak improved for {high_note}"))

        return awarded

    def milestone_exists(self, key):
        row = self.db.fetchone(
            "SELECT id FROM vocal_milestones WHERE milestone=?", (key,))
        return row is not None

    def log_milestone(self, key):
        try:
            self.db.execute(
                "INSERT OR IGNORE INTO vocal_milestones (milestone) VALUES (?)",
                (key,))
        except Exception:
            pass

