from datetime import date as dt


class MindModel:
    def __init__(self, db):
        self.db = db
        self._ensure_tables()

    def _ensure_tables(self):
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS focus_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                duration   INTEGER NOT NULL,
                type       TEXT DEFAULT 'deep_work',
                note       TEXT,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS mood_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                score      INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
                energy     INTEGER NOT NULL CHECK(energy BETWEEN 1 AND 5),
                note       TEXT,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS journal_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                content    TEXT NOT NULL,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

    def log_focus(self, duration, type_="deep_work", note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO focus_log (duration, type, note, date)
               VALUES (?,?,?,?)""",
            (duration, type_, note, date))
        self._update_mind_stat()

    def log_mood(self, score, energy, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO mood_log (score, energy, note, date)
               VALUES (?,?,?,?)""",
            (score, energy, note, date))
        self._update_mind_stat()

    def log_journal(self, content, date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            "INSERT INTO journal_log (content, date) VALUES (?,?)",
            (content, date))
        self._update_mind_stat()

    def get_focus(self, limit=7):
        return self.db.fetchall(
            "SELECT * FROM focus_log ORDER BY date DESC LIMIT ?",
            (limit,))

    def get_mood(self, limit=7):
        return self.db.fetchall(
            "SELECT * FROM mood_log ORDER BY date DESC LIMIT ?",
            (limit,))

    def get_journal(self, limit=5):
        return self.db.fetchall(
            "SELECT * FROM journal_log ORDER BY date DESC LIMIT ?",
            (limit,))

    def delete_focus(self, id_):
        self.db.execute("DELETE FROM focus_log WHERE id=?", (id_,))
        self._update_mind_stat()

    def delete_mood(self, id_):
        self.db.execute("DELETE FROM mood_log WHERE id=?", (id_,))
        self._update_mind_stat()

    def delete_journal(self, id_):
        self.db.execute(
            "DELETE FROM journal_log WHERE id=?", (id_,))

    def _update_mind_stat(self):
        focus = self.db.fetchone(
            """SELECT COALESCE(SUM(duration),0) as total
               FROM focus_log
               WHERE date >= date('now','-7 days')""")
        focus_score = min(40, (focus["total"] / 420) * 40)

        mood = self.db.fetchone(
            """SELECT AVG(score) as s, AVG(energy) as e
               FROM mood_log
               WHERE date >= date('now','-7 days')""")
        mood_score = 0
        if mood and mood["s"]:
            mood_score = ((mood["s"] / 5) * 30 +
                          (mood["e"] / 5) * 15)

        journal = self.db.fetchone(
            """SELECT COUNT(*) as c FROM journal_log
               WHERE date >= date('now','-7 days')""")
        journal_score = min(15, (journal["c"] if journal else 0) * 3)

        value = min(100, focus_score + mood_score + journal_score)
        from shared.theme import get_rank
        self.db.execute(
            "UPDATE stats SET value=?, rank=? WHERE name='Mind'",
            (value, get_rank(value)))

