from modules.dexterity.model import (
    DexterityModel, midi_to_note, level_from_xp, xp_to_next_level
)

DEXTERITY_TYPES = [
    "Drawing", "Singing", "Design", "Writing",
    "Coding", "Craft", "Music",
    "Calligraphy", "Video Editing", "Other"
]


class DexterityController:
    def __init__(self, db):
        self.model = DexterityModel(db)

    # ── Original dexterity ────────────────────────────────────────

    def log_session(self, type_, duration, note=""):
        try:
            duration = int(duration)
            if duration <= 0:
                return False, "Enter valid duration."
            self.model.log_session(type_, duration, note)
            return True, f"{type_} — {duration}mins logged."
        except ValueError:
            return False, "Invalid duration."

    def get_recent_sessions(self, limit=7):
        return [dict(r) for r in self.model.get_sessions(limit)]

    def delete_session(self, id_):
        self.model.delete_session(id_)

    # ── Vocal ─────────────────────────────────────────────────────

    def log_vocal_session(self, session_type, low_note, high_note,
                          low_midi, high_midi, semitones,
                          tess_low, tess_high, voice_type,
                          peak_duration, cold_to_peak,
                          exercise_name=None, accuracy_score=None):
        session = {
            "session_type":   session_type,
            "low_note":       low_note,
            "high_note":      high_note,
            "low_midi":       low_midi,
            "high_midi":      high_midi,
            "semitones":      semitones,
            "tess_low":       tess_low,
            "tess_high":      tess_high,
            "voice_type":     voice_type,
            "peak_duration":  peak_duration,
            "cold_to_peak":   cold_to_peak,
            "exercise_name":  exercise_name,
            "accuracy_score": accuracy_score,
        }

        # Check XP before saving (uses previous bests)
        xp_breakdown = self.model.check_and_award_xp(session)

        # Save session
        self.model.log_vocal_session(
            session_type, low_note, high_note,
            low_midi, high_midi, semitones,
            tess_low, tess_high, voice_type,
            peak_duration, cold_to_peak,
            exercise_name, accuracy_score)

        xp_earned = sum(x for x, _ in xp_breakdown)

        # Compute level before and after
        prev_xp = self.model.get_total_vocal_xp() - xp_earned
        prev_level, _ = level_from_xp(max(0, prev_xp))
        new_level = self.model.get_vocal_level()
        level_up = new_level > prev_level

        # Rank and title
        prev_rank = self._get_prev_rank()
        new_rank = self.model.get_vocal_rank()
        rank_changed = new_rank != prev_rank

        prev_title = self._get_prev_title()
        new_title = self.model.get_vocal_title()
        title_changed = new_title != prev_title

        return {
            "xp_earned":    xp_earned,
            "xp_breakdown": xp_breakdown,
            "new_level":    new_level,
            "level_up":     level_up,
            "rank":         new_rank,
            "rank_changed": rank_changed,
            "title":        new_title,
            "title_changed": title_changed,
        }

    def _get_prev_rank(self):
        sessions = self.model.get_last_n_performance_sessions(1)
        if not sessions:
            return "E"
        return self.model.get_vocal_rank()

    def _get_prev_title(self):
        return self.model.get_vocal_title()

    def get_vocal_stats(self):
        level, remainder, needed = self.model.get_xp_to_next_level()
        best = self.model.get_vocal_best()
        rank = self.model.get_vocal_rank()
        voice_type = self.model.get_voice_type()
        title = self.model.get_vocal_title()
        sessions = self.model.get_last_n_performance_sessions(30)

        # Streak — consecutive days with a performance session
        streak = 0
        if sessions:
            from datetime import datetime, timedelta
            dates = sorted(set(s["date"] for s in sessions), reverse=True)
            today = datetime.today().date()
            expected = today
            for d in dates:
                session_date = datetime.fromisoformat(d).date()
                if session_date == expected:
                    streak += 1
                    expected -= timedelta(days=1)
                else:
                    break

        best_range = (
            f"{midi_to_note(best['best_low'])} — "
            f"{midi_to_note(best['best_high'])}"
            if best["best_low"] and best["best_high"] else "—"
        )
        last_date = sessions[0]["date"] if sessions else None

        return {
            "level":           level,
            "xp_remainder":    remainder,
            "xp_to_next":      needed,
            "rank":            rank,
            "voice_type":      voice_type,
            "title":           title,
            "best_range":      best_range,
            "best_semitones":  best["best_semitones"] or 0,
            "streak":          streak,
            "last_session_date": last_date,
        }

    def get_vocal_history(self, limit=10):
        return [dict(r) for r in
                self.model.get_vocal_sessions(limit)]

    def get_warmup_history(self, exercise_name, limit=5):
        rows = self.model.get_vocal_sessions(
            limit, session_type="warmup")
        return [dict(r) for r in rows
                if r["exercise_name"] == exercise_name]

    def get_warmup_best(self, exercise_name):
        return self.model.get_warmup_best(exercise_name)

