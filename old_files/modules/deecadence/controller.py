from modules.deecadence.model import DeeCadenceModel
import json
import math

DISTRACTION_TYPES = [
    "Social Media", "YouTube", "Gaming",
    "Conversations", "Phone browsing",
    "Daydreaming", "TV/Netflix", "Other"
]

DIFFICULTY_LABELS = {
    1: "Very Easy",
    2: "Easy",
    3: "Moderate",
    4: "Hard",
    5: "Extreme"
}


def calculate_blocks(total_mins, difficulty):
    """
    Divides total_mins into 4 focus blocks with breaks.
    Break times rounded up to whole minutes.
    Focus times fit remaining time equally.
    Short break between blocks 1-3, long break after block 4.
    """
    num_blocks = 4

    # Break durations based on difficulty
    short_break = math.ceil(total_mins * 0.08)
    short_break = max(1, short_break)
    long_break = math.ceil(total_mins * 0.2)
    long_break = max(2, long_break)

    # Total break time (3 short breaks between blocks)
    total_breaks = (3 * short_break)
    remaining = total_mins - total_breaks

    # Focus time split equally
    focus_per_block = remaining // num_blocks
    focus_per_block = max(1, focus_per_block)

    return {
        "num_blocks":    num_blocks,
        "focus_mins":    focus_per_block,
        "short_break":   short_break,
        "long_break":    long_break,
        "total_mins":    total_mins,
    }


class DeeCadenceController:
    def __init__(self, db):
        self.model = DeeCadenceModel(db)

    # ── Distraction ───────────────────────────────────────────────

    def log_distraction(self, hours_lost, distraction_type):
        try:
            hours = float(hours_lost)
            if hours <= 0 or hours > 24:
                return False, "Enter valid hours (0-24)."
            if not distraction_type:
                return False, "Select a distraction type."
            self.model.log_distraction(hours, distraction_type)
            return True, "Distraction logged."
        except ValueError:
            return False, "Invalid hours value."

    def get_focus_debt(self):
        mins = self.model.get_total_focus_debt()
        if mins >= 60:
            hrs = mins / 60
            return f"{hrs:.1f} hours", mins
        return f"{mins} minutes", mins

    def get_debt_history(self):
        return self.model.get_debt_history()

    def get_recent_distractions(self, limit=5):
        return [dict(r) for r in
                self.model.get_recent_distractions(limit)]

    # ── Attention score ───────────────────────────────────────────

    def get_attention_score(self):
        return self.model.get_attention_score()

    def get_attention_history(self):
        rows = self.model.get_attention_history(14)
        return [dict(r) for r in rows]

    # ── Focus session ─────────────────────────────────────────────

    def start_session(self, task_name, total_mins, difficulty):
        if not task_name.strip():
            return None, "Enter a task name."
        try:
            total_mins = int(total_mins)
            difficulty = int(difficulty)
            if total_mins < 4:
                return None, "Minimum 4 minutes."
            if not (1 <= difficulty <= 5):
                return None, "Difficulty must be 1-5."
        except ValueError:
            return None, "Invalid input."

        blocks = calculate_blocks(total_mins, difficulty)
        session_id = self.model.start_focus_session(
            task_name.strip(), total_mins, difficulty)
        return session_id, blocks

    def get_active_session(self):
        session = self.model.get_active_session()
        if not session:
            return None
        session["energy_scores"] = json.loads(
            session.get("energy_scores", "[]"))
        blocks = calculate_blocks(
            session["total_mins"], session["difficulty"])
        session["blocks"] = blocks
        return session

    def complete_block(self, session_id,
                       blocks_done, energy_scores):
        self.model.update_session_block(
            session_id, blocks_done, energy_scores)

    def complete_session(self, session_id,
                         blocks_done, energy_scores):
        self.model.complete_session(
            session_id, blocks_done, energy_scores)

    def abandon_session(self, session_id):
        self.model.abandon_session(session_id)

    def get_recent_sessions(self, limit=7):
        rows = self.model.get_recent_sessions(limit)
        result = []
        for r in rows:
            d = dict(r)
            d["energy_scores"] = json.loads(
                d.get("energy_scores", "[]"))
            result.append(d)
        return result

    def get_summary(self):
        debt_str, debt_mins = self.get_focus_debt()
        score = self.get_attention_score()
        active = self.get_active_session()
        return {
            "attention_score": score,
            "focus_debt":      debt_str,
            "focus_debt_mins": debt_mins,
            "has_active":      active is not None,
            "active_session":  active,
        }
    

