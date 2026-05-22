from datetime import date as dt

class SpiritModel:
    def __init__(self, db):
        self.db = db
        self._ensure_tables()

    def _ensure_tables(self):
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS prayer_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                type        TEXT NOT NULL CHECK(type IN ('morning','night','other')),
                note        TEXT,
                date        TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS bible_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                passage     TEXT NOT NULL,
                note        TEXT,
                date        TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS meditation_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                duration    INTEGER NOT NULL,
                note        TEXT,
                date        TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS td_events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                event_date  TEXT NOT NULL,
                event_type  TEXT DEFAULT 'meeting',
                notes       TEXT,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS td_meeting_notes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id    INTEGER,
                title       TEXT NOT NULL,
                content     TEXT NOT NULL,
                date        TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (event_id) REFERENCES td_events(id)
            )
        """)

    # ── Prayer ────────────────────────────────────────────────────

    def log_prayer(self, type_, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            "INSERT INTO prayer_log (type, note, date) VALUES (?,?,?)",
            (type_, note, date)
        )
        self._update_spirit_stat()

    def get_prayers(self, limit=30):
        return self.db.fetchall(
            "SELECT * FROM prayer_log ORDER BY date DESC LIMIT ?",
            (limit,)
        )

    def get_today_prayers(self):
        return self.db.fetchall(
            "SELECT * FROM prayer_log WHERE date=?",
            (dt.today().isoformat(),)
        )

    def delete_prayer(self, id_):
        self.db.execute("DELETE FROM prayer_log WHERE id=?", (id_,))
        self._update_spirit_stat()

    # ── Bible ─────────────────────────────────────────────────────

    def log_bible(self, passage, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            "INSERT INTO bible_log (passage, note, date) VALUES (?,?,?)",
            (passage, note, date)
        )
        self._update_spirit_stat()

    def get_bible_logs(self, limit=30):
        return self.db.fetchall(
            "SELECT * FROM bible_log ORDER BY date DESC LIMIT ?",
            (limit,)
        )

    def get_today_bible(self):
        return self.db.fetchall(
            "SELECT * FROM bible_log WHERE date=?",
            (dt.today().isoformat(),)
        )

    def delete_bible_log(self, id_):
        self.db.execute("DELETE FROM bible_log WHERE id=?", (id_,))
        self._update_spirit_stat()

    # ── Meditation ────────────────────────────────────────────────

    def log_meditation(self, duration, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            "INSERT INTO meditation_log (duration, note, date) VALUES (?,?,?)",
            (duration, note, date)
        )
        self._update_spirit_stat()

    def get_meditations(self, limit=30):
        return self.db.fetchall(
            "SELECT * FROM meditation_log ORDER BY date DESC LIMIT ?",
            (limit,)
        )

    def delete_meditation(self, id_):
        self.db.execute(
            "DELETE FROM meditation_log WHERE id=?", (id_,))
        self._update_spirit_stat()

    # ── Teenagers Department Events ───────────────────────────────

    def add_event(self, title, event_date, event_type="meeting", notes=""):
        self.db.execute(
            """INSERT INTO td_events
               (title, event_date, event_type, notes)
               VALUES (?,?,?,?)""",
            (title, event_date, event_type, notes)
        )

    def get_events(self, limit=20):
        return self.db.fetchall(
            """SELECT * FROM td_events
               ORDER BY event_date DESC LIMIT ?""",
            (limit,)
        )

    def get_upcoming_events(self):
        today = dt.today().isoformat()
        return self.db.fetchall(
            """SELECT * FROM td_events
               WHERE event_date >= ?
               ORDER BY event_date ASC LIMIT 5""",
            (today,)
        )

    def delete_event(self, id_):
        self.db.execute(
            "DELETE FROM td_events WHERE id=?", (id_,))
        self.db.execute(
            "DELETE FROM td_meeting_notes WHERE event_id=?", (id_,))

    # ── Meeting Notes ─────────────────────────────────────────────

    def add_meeting_note(self, title, content, date=None, event_id=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO td_meeting_notes
               (event_id, title, content, date)
               VALUES (?,?,?,?)""",
            (event_id, title, content, date)
        )

    def get_meeting_notes(self, limit=20):
        return self.db.fetchall(
            """SELECT * FROM td_meeting_notes
               ORDER BY date DESC LIMIT ?""",
            (limit,)
        )

    def delete_meeting_note(self, id_):
        self.db.execute(
            "DELETE FROM td_meeting_notes WHERE id=?", (id_,))

    # ── Stat Sync ─────────────────────────────────────────────────

    def _update_spirit_stat(self):
        today = dt.today().isoformat()
        week_start = dt.today().strftime("%Y-%m-") + \
            str(dt.today().day - dt.today().weekday()).zfill(2)

        prayers_today = self.db.fetchone(
            "SELECT COUNT(*) as c FROM prayer_log WHERE date=?",
            (today,)
        )["c"]

        bible_this_week = self.db.fetchone(
            """SELECT COUNT(*) as c FROM bible_log
               WHERE date >= ?""",
            (week_start,)
        )["c"]

        meditation_this_week = self.db.fetchone(
            """SELECT COUNT(*) as c FROM meditation_log
               WHERE date >= ?""",
            (week_start,)
        )["c"]

        # Score: prayers(0-40) + bible(0-30) + meditation(0-30)
        prayer_score = min(40, prayers_today * 20)
        bible_score = min(30, bible_this_week * 10)
        meditation_score = min(30, meditation_this_week * 10)
        value = prayer_score + bible_score + meditation_score

        from shared.theme import get_rank
        rank = get_rank(value)
        self.db.execute(
            "UPDATE stats SET value=?, rank=? WHERE name='Spirit'",
            (value, rank)
        )
