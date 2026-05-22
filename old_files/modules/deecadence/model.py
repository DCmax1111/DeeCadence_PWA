from datetime import date as dt
import json


class DeeCadenceModel:
    def __init__(self, db):
        self.db = db
        self._ensure_tables()

    def _ensure_tables(self):
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS distraction_log (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                hours_lost      REAL NOT NULL,
                distraction_type TEXT NOT NULL,
                focus_debt_mins INTEGER NOT NULL,
                date            TEXT NOT NULL,
                created_at      TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS debt_payments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                mins_paid   INTEGER NOT NULL,
                date        TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS focus_sessions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                task_name       TEXT NOT NULL,
                total_mins      INTEGER NOT NULL,
                difficulty      INTEGER NOT NULL,
                blocks_done     INTEGER DEFAULT 0,
                energy_scores   TEXT DEFAULT '[]',
                completed       INTEGER DEFAULT 0,
                date            TEXT NOT NULL,
                created_at      TEXT DEFAULT (datetime('now'))
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS attention_scores (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                score       REAL NOT NULL,
                date        TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)

    # ── Distraction ───────────────────────────────────────────────

    def log_distraction(self, hours_lost, distraction_type):
        date = dt.today().isoformat()
        focus_debt_mins = int(hours_lost * 60)
        self.db.execute(
            """INSERT INTO distraction_log
               (hours_lost, distraction_type, focus_debt_mins, date)
               VALUES (?,?,?,?)""",
            (hours_lost, distraction_type, focus_debt_mins, date))
        self._recalculate_attention_score()

    def get_total_focus_debt(self):
        earned = self.db.fetchone(
            """SELECT COALESCE(SUM(focus_debt_mins),0) as total
               FROM distraction_log""")
        paid = self.db.fetchone(
            """SELECT COALESCE(SUM(mins_paid),0) as total
               FROM debt_payments""")
        total_debt = (earned["total"] if earned else 0)
        total_paid = (paid["total"] if paid else 0)
        return max(0, total_debt - total_paid)

    def get_recent_distractions(self, limit=7):
        return self.db.fetchall(
            """SELECT * FROM distraction_log
               ORDER BY date DESC LIMIT ?""", (limit,))

    def pay_debt(self, mins):
        self.db.execute(
            """INSERT INTO debt_payments (mins_paid, date)
               VALUES (?,?)""",
            (mins, dt.today().isoformat()))
        self._recalculate_attention_score()

    def get_debt_history(self):
        """Returns daily net debt for last 14 days."""
        rows = self.db.fetchall(
            """SELECT date,
               SUM(focus_debt_mins) as debt_added
               FROM distraction_log
               WHERE date >= date('now','-14 days')
               GROUP BY date ORDER BY date ASC""")
        payments = self.db.fetchall(
            """SELECT date,
               SUM(mins_paid) as paid
               FROM debt_payments
               WHERE date >= date('now','-14 days')
               GROUP BY date ORDER BY date ASC""")
        debt_by_date = {r["date"]: r["debt_added"] for r in rows}
        paid_by_date = {r["date"]: r["paid"] for r in payments}
        all_dates = sorted(set(
            list(debt_by_date.keys()) +
            list(paid_by_date.keys())))
        result = []
        running_debt = 0
        for d in all_dates:
            running_debt += debt_by_date.get(d, 0)
            running_debt -= paid_by_date.get(d, 0)
            running_debt = max(0, running_debt)
            result.append({"date": d, "debt": running_debt})
        return result

    # ── Focus sessions ────────────────────────────────────────────

    def start_focus_session(self, task_name, total_mins, difficulty):
        date = dt.today().isoformat()
        self.db.execute(
            """INSERT INTO focus_sessions
               (task_name, total_mins, difficulty, date)
               VALUES (?,?,?,?)""",
            (task_name, total_mins, difficulty, date))
        return self.db.lastrowid

    def update_session_block(self, session_id,
                             blocks_done, energy_scores):
        self.db.execute(
            """UPDATE focus_sessions
               SET blocks_done=?, energy_scores=?
               WHERE id=?""",
            (blocks_done,
             json.dumps(energy_scores),
             session_id))

    def complete_session(self, session_id,
                         blocks_done, energy_scores):
        self.db.execute(
            """UPDATE focus_sessions
               SET blocks_done=?, energy_scores=?,
               completed=1 WHERE id=?""",
            (blocks_done,
             json.dumps(energy_scores),
             session_id))
        # Pay debt for focused time
        session = self.db.fetchone(
            "SELECT * FROM focus_sessions WHERE id=?",
            (session_id,))
        if session:
            self.pay_debt(session["total_mins"])
        self._recalculate_attention_score()

    def get_active_session(self):
        row = self.db.fetchone(
            """SELECT * FROM focus_sessions
               WHERE completed=0
               ORDER BY created_at DESC LIMIT 1""")
        return dict(row) if row else None

    def get_recent_sessions(self, limit=10):
        return self.db.fetchall(
            """SELECT * FROM focus_sessions
               ORDER BY date DESC LIMIT ?""", (limit,))

    def abandon_session(self, session_id):
        self.db.execute(
            """UPDATE focus_sessions
               SET completed=1 WHERE id=?""",
            (session_id,))

    # ── Attention score ───────────────────────────────────────────

    def _recalculate_attention_score(self):
        """
        Score = 100 - (debt_ratio * 60) + consistency_bonus
        Debt ratio = current debt / (avg daily debt * 7)
        Consistency bonus = up to 20 pts for consecutive
        debt-reducing days
        """
        debt = self.get_total_focus_debt()
        avg = self.db.fetchone(
            """SELECT AVG(focus_debt_mins) as avg
               FROM distraction_log
               WHERE date >= date('now','-7 days')""")
        avg_daily = avg["avg"] if avg and avg["avg"] else 60
        baseline = avg_daily * 7
        debt_ratio = min(1.0, debt / max(1, baseline))
        debt_penalty = debt_ratio * 60

        # Consistency bonus — days where debt went down
        history = self.get_debt_history()
        streak = 0
        for i in range(1, len(history)):
            if history[i]["debt"] < history[i-1]["debt"]:
                streak += 1
            else:
                break
        consistency_bonus = min(20, streak * 4)

        score = max(0, min(100,
                           100 - debt_penalty + consistency_bonus))
        today = dt.today().isoformat()
        existing = self.db.fetchone(
            "SELECT id FROM attention_scores WHERE date=?",
            (today,))
        if existing:
            self.db.execute(
                "UPDATE attention_scores SET score=? WHERE date=?",
                (score, today))
        else:
            self.db.execute(
                """INSERT INTO attention_scores (score, date)
                   VALUES (?,?)""", (score, today))

    def get_attention_score(self):
        row = self.db.fetchone(
            """SELECT score FROM attention_scores
               ORDER BY date DESC LIMIT 1""")
        return round(row["score"], 1) if row else 100.0

    def get_attention_history(self, days=14):
        return self.db.fetchall(
            """SELECT date, score FROM attention_scores
               WHERE date >= date('now','-? days')
               ORDER BY date ASC""", (days,))
    
    