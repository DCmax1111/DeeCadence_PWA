from modules.energy.model import EnergyModel

EXERCISE_TYPES = [
    "Running", "Walking", "Gym", "Cycling",
    "Swimming", "Football", "Basketball",
    "Stretching", "HIIT", "Other"
]

HYGIENE_ITEMS = [
    "Shower", "Brush teeth", "Body cream",
    "Hair care", "Wash face", "Laundry", "Other"
]


class EnergyController:
    def __init__(self, db):
        self.model = EnergyModel(db)

    def log_sleep(self, hours, quality, note=""):
        try:
            hours = float(hours)
            quality = int(quality)
            if not (0 < hours <= 24):
                return False, "Enter valid sleep hours."
            if not (1 <= quality <= 5):
                return False, "Quality must be 1-5."
            self.model.log_sleep(hours, quality, note)
            return True, f"Sleep logged — {hours}hrs Q{quality}"
        except ValueError:
            return False, "Invalid input."

    def log_hydration(self, glasses):
        try:
            glasses = int(glasses)
            if glasses <= 0:
                return False, "Enter valid glass count."
            self.model.log_hydration(glasses)
            return True, f"+{glasses} glass(es) logged."
        except ValueError:
            return False, "Invalid input."

    def log_exercise(self, type_, duration, intensity, note=""):
        try:
            duration = int(duration)
            intensity = int(intensity)
            if duration <= 0:
                return False, "Enter valid duration."
            if not (1 <= intensity <= 5):
                return False, "Intensity must be 1-5."
            self.model.log_exercise(
                type_, duration, intensity, note)
            return True, f"{type_} logged — {duration}mins"
        except ValueError:
            return False, "Invalid input."

    def log_hygiene(self, items):
        if not items:
            return False, "Select at least one item."
        self.model.log_hygiene(", ".join(items))
        return True, "Hygiene logged."

    def get_summary(self):
        today_hydration = self.model.get_today_hydration()
        today_sleep = self.model.get_today_sleep()
        today_hygiene = self.model.get_today_hygiene()
        recent_exercise = self.model.get_exercise(3)
        return {
            "hydration": today_hydration,
            "sleep": dict(today_sleep) if today_sleep else None,
            "hygiene": today_hygiene,
            "recent_exercise": [dict(e) for e in recent_exercise]
        }

    def get_recent_sleep(self, limit=5):
        return [dict(r) for r in self.model.get_sleep(limit)]

    def get_recent_exercise(self, limit=5):
        return [dict(r) for r in self.model.get_exercise(limit)]

    def delete_sleep(self, id_):
        self.model.delete_sleep(id_)

    def delete_exercise(self, id_):
        self.model.delete_exercise(id_)


