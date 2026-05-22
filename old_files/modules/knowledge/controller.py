from modules.knowledge.model import KnowledgeModel


class KnowledgeController:
    def __init__(self, db):
        self.model = KnowledgeModel(db)

    def log_reading(self, title, pages="0", note=""):
        if not title.strip():
            return False, "Enter a book or article title."
        try:
            pages = int(pages) if pages else 0
        except ValueError:
            pages = 0
        self.model.log_reading(title.strip(), pages, note)
        return True, f"Reading logged — {title}"

    def log_vocab(self, word, meaning):
        if not word.strip() or not meaning.strip():
            return False, "Enter both word and meaning."
        self.model.log_vocab(word.strip(), meaning.strip())
        return True, f"'{word}' added to vocabulary."

    def log_skill(self, skill, duration, note=""):
        if not skill.strip():
            return False, "Enter skill name."
        try:
            duration = int(duration)
            if duration <= 0:
                return False, "Enter valid duration."
        except ValueError:
            return False, "Invalid duration."
        self.model.log_skill(skill.strip(), duration, note)
        return True, f"{skill} — {duration}mins logged."

    def get_recent_reading(self, limit=5):
        return [dict(r) for r in self.model.get_reading(limit)]

    def get_recent_vocab(self, limit=8):
        return [dict(r) for r in self.model.get_vocab(limit)]

    def get_recent_skills(self, limit=5):
        return [dict(r) for r in self.model.get_skills(limit)]

    def delete_reading(self, id_):
        self.model.delete_reading(id_)

    def delete_vocab(self, id_):
        self.model.delete_vocab(id_)

    def delete_skill(self, id_):
        self.model.delete_skill(id_)
