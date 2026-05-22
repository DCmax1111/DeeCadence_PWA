from datetime import date as dt
from shared.theme import CURRENCY_SYMBOL

class FinancialModel:
    def __init__(self, db):
        self.db = db

    # ── Transactions ──────────────────────────────────────────────

    def add_transaction(self, type_, amount, category, note="", date=None):
        date = date or dt.today().isoformat()
        self.db.execute(
            """INSERT INTO transactions
               (type, amount, category, note, date)
               VALUES (?, ?, ?, ?, ?)""",
            (type_, amount, category, note, date)
        )
        self._update_financial_stat()

    def get_transactions(self, limit=50):
        return self.db.fetchall(
            """SELECT * FROM transactions
               ORDER BY date DESC, created_at DESC
               LIMIT ?""",
            (limit,)
        )

    def get_transactions_by_type(self, type_, limit=50):
        return self.db.fetchall(
            """SELECT * FROM transactions
               WHERE type = ?
               ORDER BY date DESC
               LIMIT ?""",
            (type_, limit)
        )

    def delete_transaction(self, id_):
        self.db.execute("DELETE FROM transactions WHERE id = ?", (id_,))
        self._update_financial_stat()

    # ── Summaries ─────────────────────────────────────────────────

    def get_total_income(self, month=None):
        return self._sum_by_type("income", month)

    def get_total_expenses(self, month=None):
        return self._sum_by_type("expense", month)

    def get_cashflow(self, month=None):
        return self.get_total_income(month) - self.get_total_expenses(month)

    def get_monthly_summary(self):
        month = dt.today().strftime("%Y-%m")
        income = self.get_total_income(month)
        expenses = self.get_total_expenses(month)
        cashflow = income - expenses
        return {
            "income": income,
            "expenses": expenses,
            "cashflow": cashflow,
            "month": dt.today().strftime("%B %Y"),
            "symbol": CURRENCY_SYMBOL
        }

    def get_expense_breakdown(self):
        rows = self.db.fetchall(
            """SELECT category, SUM(amount) as total
               FROM transactions
               WHERE type='expense'
               AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
               GROUP BY category
               ORDER BY total DESC"""
        )
        return [(r["category"], r["total"]) for r in rows]

    def _sum_by_type(self, type_, month=None):
        if month:
            row = self.db.fetchone(
                """SELECT COALESCE(SUM(amount), 0) as total
                   FROM transactions
                   WHERE type=? AND strftime('%Y-%m', date)=?""",
                (type_, month)
            )
        else:
            row = self.db.fetchone(
                """SELECT COALESCE(SUM(amount), 0) as total
                   FROM transactions WHERE type=?""",
                (type_,)
            )
        return row["total"] if row else 0

    # ── Goals ─────────────────────────────────────────────────────

    def add_goal(self, title, target, deadline=None):
        self.db.execute(
            """INSERT INTO financial_goals (title, target, deadline)
               VALUES (?, ?, ?)""",
            (title, target, deadline)
        )

    def get_goals(self):
        return self.db.fetchall(
            "SELECT * FROM financial_goals ORDER BY created_at DESC"
        )

    def update_goal_progress(self, goal_id, amount):
        self.db.execute(
            "UPDATE financial_goals SET current=? WHERE id=?",
            (amount, goal_id)
        )

    def delete_goal(self, goal_id):
        self.db.execute(
            "DELETE FROM financial_goals WHERE id=?", (goal_id,)
        )

    # ── Stat sync ─────────────────────────────────────────────────

    def _update_financial_stat(self):
        """Recalculate Financial stat based on cashflow health."""
        summary = self.get_monthly_summary()
        income = summary["income"]
        expenses = summary["expenses"]

        if income == 0:
            value = 50
        else:
            ratio = (income - expenses) / income
            value = max(0, min(100, 50 + (ratio * 50)))

        from shared.theme import get_rank
        rank = get_rank(value)
        self.db.execute(
            """UPDATE stats SET value=?, rank=?
               WHERE name='Financial'""",
            (value, rank)
        )

