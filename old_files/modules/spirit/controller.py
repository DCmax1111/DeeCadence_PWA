from modules.spirit.model import SpiritModel


class SpiritController:
    def __init__(self, db):
        self.model = SpiritModel(db)

    # ── Prayer ────────────────────────────────────────────────────

    def log_prayer(self, type_, note=""):
        if type_ not in ("morning", "night", "other"):
            return False, "Invalid prayer type."
        self.model.log_prayer(type_, note)
        return True, "Prayer logged. ✦"

    def get_today_prayers(self):
        return [dict(r) for r in self.model.get_today_prayers()]

    def get_recent_prayers(self, limit=20):
        return [dict(r) for r in self.model.get_prayers(limit)]

    def delete_prayer(self, id_):
        self.model.delete_prayer(id_)

    # ── Bible ─────────────────────────────────────────────────────

    def log_bible(self, passage, note=""):
        if not passage.strip():
            return False, "Please enter a passage."
        self.model.log_bible(passage.strip(), note.strip())
        return True, "Bible reading logged."

    def get_today_bible(self):
        return [dict(r) for r in self.model.get_today_bible()]

    def get_recent_bible(self, limit=20):
        return [dict(r) for r in self.model.get_bible_logs(limit)]

    def delete_bible_log(self, id_):
        self.model.delete_bible_log(id_)

    # ── Meditation ────────────────────────────────────────────────

    def log_meditation(self, duration, note=""):
        try:
            duration = int(duration)
            if duration <= 0:
                return False, "Duration must be greater than 0."
            self.model.log_meditation(duration, note)
            return True, f"Meditation logged — {duration} mins."
        except ValueError:
            return False, "Enter a valid duration in minutes."

    def get_recent_meditations(self, limit=20):
        return [dict(r) for r in self.model.get_meditations(limit)]

    def delete_meditation(self, id_):
        self.model.delete_meditation(id_)

    # ── Teenagers Department ──────────────────────────────────────

    def add_event(self, title, event_date, event_type="meeting", notes=""):
        if not title.strip():
            return False, "Event title required."
        if not event_date.strip():
            return False, "Event date required."
        self.model.add_event(
            title.strip(), event_date.strip(), event_type, notes.strip())
        return True, "Event added."

    def get_upcoming_events(self):
        return [dict(r) for r in self.model.get_upcoming_events()]

    def get_all_events(self):
        return [dict(r) for r in self.model.get_events()]

    def delete_event(self, id_):
        self.model.delete_event(id_)

    def add_meeting_note(self, title, content, event_id=None):
        if not title.strip():
            return False, "Note title required."
        if not content.strip():
            return False, "Note content required."
        self.model.add_meeting_note(
            title.strip(), content.strip(), event_id=event_id)
        return True, "Meeting note saved."

    def get_meeting_notes(self, limit=20):
        return [dict(r) for r in self.model.get_meeting_notes(limit)]

    def delete_meeting_note(self, id_):
        self.model.delete_meeting_note(id_)

    # ── Dashboard summary ─────────────────────────────────────────

    def get_summary(self):
        today_prayers = self.get_today_prayers()
        today_bible = self.get_today_bible()
        upcoming = self.get_upcoming_events()
        return {
            "prayers_today": len(today_prayers),
            "bible_today": len(today_bible),
            "upcoming_events": upcoming
        }
