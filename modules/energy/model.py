from datetime import date as dt


class EnergyModel:
    def __init__(self, db):
        self.db = db
        self._ensure_tables()

    def _ensure_tables(self):
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS sleep_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                hours      REAL NOT NULL,
                quality    INTEGER NOT NULL CHECK(quality BETWEEN 1 AND 5),
                note       TEXT,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS hydration_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                glasses    INTEGER NOT NULL,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS exercise_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                type       TEXT NOT NULL,
                duration   INTEGER NOT NULL,
                intensity  INTEGER NOT NULL CHECK(intensity BETWEEN 1 AND 5),
                note       TEXT,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS hygiene_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                items      TEXT NOT NULL,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

    # ── Sleep ─────────────────────────────────────────────────────

    def log_sleep(self, hours, quality, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO sleep_log (hours, quality, note, date)
               VALUES (?,?,?,?)""",
            (hours, quality, note, date)
        )
        self._update_body_stat()

    def get_sleep(self, limit=7):
        return self.db.fetchall(
            """SELECT * FROM sleep_log
               ORDER BY date DESC LIMIT ?""", (limit,))

    def get_today_sleep(self):
        return self.db.fetchone(
            "SELECT * FROM sleep_log WHERE date=? ORDER BY id DESC",
            (dt.today().isoformat(),))

    def delete_sleep(self, id_):
        self.db.execute("DELETE FROM sleep_log WHERE id=?", (id_,))
        self._update_body_stat()

    # ── Hydration ─────────────────────────────────────────────────

    def log_hydration(self, glasses, date=None):
        date = date or dt.today().isoformat()
        existing = self.db.fetchone(
            "SELECT * FROM hydration_log WHERE date=?", (date,))
        if existing:
            self.db.execute(
                """UPDATE hydration_log
                   SET glasses = glasses + ? WHERE date=?""",
                (glasses, date))
        else:
            self.db.execute(
                """INSERT INTO hydration_log (glasses, date)
                   VALUES (?,?)""", (glasses, date))
        self._update_body_stat()

    def get_today_hydration(self):
        row = self.db.fetchone(
            "SELECT * FROM hydration_log WHERE date=?",
            (dt.today().isoformat(),))
        return row["glasses"] if row else 0

    def get_hydration(self, limit=7):
        return self.db.fetchall(
            """SELECT * FROM hydration_log
               ORDER BY date DESC LIMIT ?""", (limit,))

    # ── Exercise ──────────────────────────────────────────────────

    def log_exercise(self, type_, duration, intensity, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO exercise_log
               (type, duration, intensity, note, date)
               VALUES (?,?,?,?,?)""",
            (type_, duration, intensity, note, date)
        )
        self._update_body_stat()

    def get_exercise(self, limit=10):
        return self.db.fetchall(
            """SELECT * FROM exercise_log
               ORDER BY date DESC LIMIT ?""", (limit,))

    def delete_exercise(self, id_):
        self.db.execute(
            "DELETE FROM exercise_log WHERE id=?", (id_,))
        self._update_body_stat()

    # ── Hygiene ───────────────────────────────────────────────────

    def log_hygiene(self, items, date=None):
        date = date or dt.today().isoformat()
        existing = self.db.fetchone(
            "SELECT * FROM hygiene_log WHERE date=?", (date,))
        if existing:
            self.db.execute(
                "UPDATE hygiene_log SET items=? WHERE date=?",
                (items, date))
        else:
            self.db.execute(
                """INSERT INTO hygiene_log (items, date)
                   VALUES (?,?)""", (items, date))
        self._update_body_stat()

    def get_today_hygiene(self):
        row = self.db.fetchone(
            "SELECT * FROM hygiene_log WHERE date=?",
            (dt.today().isoformat(),))
        return row["items"] if row else ""

    # ── Stat sync ─────────────────────────────────────────────────

    def _update_body_stat(self):
        today = dt.today().isoformat()

        sleep = self.db.fetchone(
            """SELECT AVG(quality) as q, AVG(hours) as h
               FROM sleep_log WHERE date >= date('now','-7 days')""")
        sleep_score = 0
        if sleep and sleep["q"]:
            quality_score = (sleep["q"] / 5) * 20
            hours_score = min(20, (sleep["h"] / 8) * 20)
            sleep_score = quality_score + hours_score

        hydration = self.db.fetchone(
            "SELECT glasses FROM hydration_log WHERE date=?",
            (today,))
        hydration_score = min(20, ((hydration["glasses"]
                              if hydration else 0) / 8) * 20)

        exercise = self.db.fetchone(
            """SELECT COUNT(*) as c FROM exercise_log
               WHERE date >= date('now','-7 days')""")
        exercise_score = min(30,
                             (exercise["c"] if exercise else 0) * 6)

        hygiene = self.db.fetchone(
            "SELECT items FROM hygiene_log WHERE date=?", (today,))
        hygiene_score = 10 if hygiene and hygiene["items"] else 0

        value = min(100,
                    sleep_score + hydration_score +
                    exercise_score + hygiene_score)

        from shared.theme import get_rank
        self.db.execute(
            "UPDATE stats SET value=?, rank=? WHERE name='Body'",
            (value, get_rank(value)))

