from modules.mind.model import MindModel

FOCUS_TYPES = [
    "Deep Work", "Study", "Reading",
    "Planning", "Creative", "Other"
]


class MindController:
    def __init__(self, db):
        self.model = MindModel(db)

    def log_focus(self, duration, type_="Deep Work", note=""):
        try:
            duration = int(duration)
            if duration <= 0:
                return False, "Enter valid duration."
            self.model.log_focus(duration, type_, note)
            return True, f"Focus session logged — {duration}mins"
        except ValueError:
            return False, "Invalid duration."

    def log_mood(self, score, energy, note=""):
        try:
            score = int(score)
            energy = int(energy)
            if not (1 <= score <= 5 and 1 <= energy <= 5):
                return False, "Scores must be 1-5."
            self.model.log_mood(score, energy, note)
            return True, "Mood logged."
        except ValueError:
            return False, "Invalid input."

    def log_journal(self, content):
        if not content.strip():
            return False, "Journal entry cannot be empty."
        self.model.log_journal(content.strip())
        return True, "Journal entry saved."

    def get_recent_focus(self, limit=5):
        return [dict(r) for r in self.model.get_focus(limit)]

    def get_recent_mood(self, limit=5):
        return [dict(r) for r in self.model.get_mood(limit)]

    def get_recent_journal(self, limit=5):
        return [dict(r) for r in self.model.get_journal(limit)]

    def delete_focus(self, id_):
        self.model.delete_focus(id_)

    def delete_mood(self, id_):
        self.model.delete_mood(id_)

    def delete_journal(self, id_):
        self.model.delete_journal(id_)

    def get_summary(self):
        focus = self.get_recent_focus(1)
        mood = self.get_recent_mood(1)
        return {
            "last_focus": focus[0] if focus else None,
            "last_mood": mood[0] if mood else None,
        }

