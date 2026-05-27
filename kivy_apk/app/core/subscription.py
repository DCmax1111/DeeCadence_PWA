MODULE_ACCESS = {
    "free": {
        "financial": True,
        "spirit": True,
        "mind": True,
        "energy": True,
        "knowledge": False,
        "dexterity": False,
        "deecadence": True,
        "voxscope": False,
    },
    "pioneer": {
        "financial": True,
        "spirit": True,
        "mind": True,
        "energy": True,
        "knowledge": True,
        "dexterity": True,
        "deecadence": True,
        "voxscope": True,
    },
    "pro": {
        "financial": True,
        "spirit": True,
        "mind": True,
        "energy": True,
        "knowledge": True,
        "dexterity": True,
        "deecadence": True,
        "voxscope": True,
    },
}


class SubscriptionState:
    def __init__(self, tier="free", active=False):
        self.tier = tier
        self.active = active

    @property
    def effective_tier(self):
        return self.tier if self.active else "free"

    def can_access(self, module_key):
        return MODULE_ACCESS.get(self.effective_tier, {}).get(module_key, False)
