from datetime import date as dt


class KnowledgeModel:
    def __init__(self, db):
        self.db = db
        self._ensure_tables()

    def _ensure_tables(self):
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS reading_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT NOT NULL,
                pages      INTEGER DEFAULT 0,
                note       TEXT,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS vocab_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                word       TEXT NOT NULL,
                meaning    TEXT NOT NULL,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS skill_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                skill      TEXT NOT NULL,
                duration   INTEGER NOT NULL,
                note       TEXT,
                date       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

    def log_reading(self, title, pages=0, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO reading_log (title, pages, note, date)
               VALUES (?,?,?,?)""",
            (title, pages, note, date))
        self._update_knowledge_stat()

    def log_vocab(self, word, meaning, date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO vocab_log (word, meaning, date)
               VALUES (?,?,?)""",
            (word, meaning, date))
        self._update_knowledge_stat()

    def log_skill(self, skill, duration, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO skill_log (skill, duration, note, date)
               VALUES (?,?,?,?)""",
            (skill, duration, note, date))
        self._update_knowledge_stat()

    def get_reading(self, limit=7):
        return self.db.fetchall(
            "SELECT * FROM reading_log ORDER BY date DESC LIMIT ?",
            (limit,))

    def get_vocab(self, limit=10):
        return self.db.fetchall(
            "SELECT * FROM vocab_log ORDER BY date DESC LIMIT ?",
            (limit,))

    def get_skills(self, limit=7):
        return self.db.fetchall(
            "SELECT * FROM skill_log ORDER BY date DESC LIMIT ?",
            (limit,))

    def delete_reading(self, id_):
        self.db.execute(
            "DELETE FROM reading_log WHERE id=?", (id_,))
        self._update_knowledge_stat()

    def delete_vocab(self, id_):
        self.db.execute(
            "DELETE FROM vocab_log WHERE id=?", (id_,))
        self._update_knowledge_stat()

    def delete_skill(self, id_):
        self.db.execute(
            "DELETE FROM skill_log WHERE id=?", (id_,))
        self._update_knowledge_stat()

    def _update_knowledge_stat(self):
        reading = self.db.fetchone(
            """SELECT COUNT(*) as c FROM reading_log
               WHERE date >= date('now','-7 days')""")
        reading_score = min(35, (reading["c"] if reading else 0) * 7)

        vocab = self.db.fetchone(
            """SELECT COUNT(*) as c FROM vocab_log
               WHERE date >= date('now','-7 days')""")
        vocab_score = min(35, (vocab["c"] if vocab else 0) * 5)

        skill = self.db.fetchone(
            """SELECT COALESCE(SUM(duration),0) as total
               FROM skill_log
               WHERE date >= date('now','-7 days')""")
        skill_score = min(30, (skill["total"] / 300) * 30)

        value = min(100, reading_score + vocab_score + skill_score)
        from shared.theme import get_rank
        self.db.execute(
            "UPDATE stats SET value=?, rank=? WHERE name='Knowledge'",
            (value, get_rank(value)))

