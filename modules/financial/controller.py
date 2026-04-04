from modules.financial.model import FinancialModel

class FinancialController:
    def __init__(self, db):
        self.model = FinancialModel(db)

    def add_income(self, amount, category, note="", date=None):
        try:
            amount = float(amount)
            if amount <= 0:
                return False, "Amount must be greater than zero."
            self.model.add_transaction("income", amount, category, note, date)
            return True, "Income added successfully."
        except ValueError:
            return False, "Invalid amount entered."

    def add_expense(self, amount, category, note="", date=None):
        try:
            amount = float(amount)
            if amount <= 0:
                return False, "Amount must be greater than zero."
            self.model.add_transaction("expense", amount, category, note, date)
            return True, "Expense added successfully."
        except ValueError:
            return False, "Invalid amount entered."

    def get_dashboard_data(self):
        return self.model.get_monthly_summary()

    def get_recent_transactions(self, limit=20):
        rows = self.model.get_transactions(limit)
        return [dict(r) for r in rows]

    def get_expense_breakdown(self):
        return self.model.get_expense_breakdown()

    def delete_transaction(self, id_):
        self.model.delete_transaction(id_)

    def add_goal(self, title, target, deadline=None):
        try:
            target = float(target)
            if target <= 0:
                return False, "Target must be greater than zero."
            self.model.add_goal(title, target, deadline)
            return True, "Goal added."
        except ValueError:
            return False, "Invalid target amount."

    def get_goals(self):
        return [dict(r) for r in self.model.get_goals()]

    def update_goal_progress(self, goal_id, amount):
        try:
            self.model.update_goal_progress(goal_id, float(amount))
            return True, "Progress updated."
        except ValueError:
            return False, "Invalid amount."

    def delete_goal(self, goal_id):
        self.model.delete_goal(goal_id)

