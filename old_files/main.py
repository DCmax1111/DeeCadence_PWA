from kivymd.app import MDApp
from kivy.uix.screenmanager import (
    ScreenManager, FadeTransition)
from kivy.core.window import Window
import os

Window.softinput_mode = "below_target"


def _load_font():
    try:
        from kivy.core.text import LabelBase
        font_dir = os.path.join(
            os.path.dirname(__file__), "assets", "fonts")
        LabelBase.register(
            name="AppFont",
            fn_regular=os.path.join(
                font_dir, "NotoSans-Regular.ttf"),
            fn_bold=os.path.join(
                font_dir, "NotoSans-Bold.ttf"))
        return "AppFont"
    except Exception:
        return "Roboto"


class TheSystemApp(MDApp):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.title = "DEE_CISTEM"
        self.user_name = "DC"
        self.onboarding_complete = False
        self.font_name = _load_font()
        self.pending_txn_type = "expense"
        self.gate = None

        # Safe database init
        try:
            from core.database import Database
            self.db = Database()
        except Exception as e:
            print(f"DB init failed: {e}")
            self.db = None

    def build(self):
        self.theme_cls.theme_style = "Dark"
        self.theme_cls.primary_palette = "Blue"

        try:
            if self.db:
                self.db.initialize()
                self._load_settings()
        except Exception as e:
            print(f"Settings load failed: {e}")

        try:
            from core.subscription import SubscriptionGate
            if self.db:
                self.gate = SubscriptionGate(self.db)
        except Exception as e:
            print(f"Gate init failed: {e}")

        sm = ScreenManager(
            transition=FadeTransition(duration=0.12))

        # Load screens safely — if one fails, skip it
        screens_to_load = [
            ("onboarding", "modules.onboarding.view", "OnboardingScreen"),
            ("navigation", "screens.navigation", "NavigationScreen"),
            ("dashboard",  "screens.dashboard",   "DashboardScreen"),
            ("financial",  "modules.financial.view", "FinancialScreen"),
            ("add_transaction", "modules.financial.view", "AddTransactionScreen"),
            ("transaction_history", "modules.financial.view", "TransactionHistoryScreen"),
            ("spirit",    "modules.spirit.view",    "SpiritScreen"),
            ("energy",    "modules.energy.view",    "EnergyScreen"),
            ("mind",      "modules.mind.view",      "MindScreen"),
            ("knowledge", "modules.knowledge.view", "KnowledgeScreen"),
            ("dexterity", "modules.dexterity.view", "DexterityScreen"),
            ("voxscope",  "modules.dexterity.voxscope_screen", "VoxScopeScreen"),
            ("deecadence","modules.deecadence.view","DeeCadenceScreen"),
            ("upgrade",   "screens.upgrade",        "UpgradeScreen"),
            ("locked_module","screens.locked_module","LockedModuleScreen"),
            ("admin",     "screens.admin",          "AdminScreen"),
            ("settings",  "screens.settings",       "SettingsScreen"),
        ]

        loaded = []
        for name, module_path, class_name in screens_to_load:
            try:
                import importlib
                mod = importlib.import_module(module_path)
                cls = getattr(mod, class_name)
                sm.add_widget(cls(name=name))
                loaded.append(name)
            except Exception as e:
                print(f"Failed to load {name}: {e}")

        print(f"Loaded screens: {loaded}")

        # Route to first available screen
        if "onboarding" in loaded and not self.onboarding_complete:
            sm.current = "onboarding"
        elif "navigation" in loaded:
            sm.current = "navigation"

        return sm

    def _load_settings(self):
        try:
            rows = self.db.fetchall(
                "SELECT key, value FROM app_settings")
            settings = {r["key"]: r["value"] for r in rows}
            self.user_name = settings.get("user_name", "DC")
            self.onboarding_complete = (
                settings.get("onboarding_complete", "0") == "1")
        except Exception:
            pass

    def navigate_to_module(self, module_key, sm):
        if self.gate and not self.gate.can_access_module(
                module_key):
            try:
                locked = sm.get_screen("locked_module")
                locked.set_module(module_key)
                sm.current = "locked_module"
            except Exception:
                pass
        else:
            try:
                sm.current = module_key
            except Exception:
                pass

    def on_stop(self):
        try:
            if self.db:
                self.db.close()
        except Exception:
            pass


if __name__ == "__main__":
    TheSystemApp().run()
