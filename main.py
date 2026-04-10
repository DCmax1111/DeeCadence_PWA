from kivymd.app import MDApp
from kivy.uix.screenmanager import ScreenManager, FadeTransition
from kivy.core.window import Window
import os

from core.database import Database
from core.subscription import SubscriptionGate
from screens.navigation import NavigationScreen
from screens.dashboard import DashboardScreen
from screens.upgrade import UpgradeScreen
from screens.locked_module import LockedModuleScreen
from modules.financial.view import (
    FinancialScreen,
    AddTransactionScreen,
    TransactionHistoryScreen
)
from modules.spirit.view import SpiritScreen
from modules.energy.view import EnergyScreen
from modules.mind.view import MindScreen
from modules.knowledge.view import KnowledgeScreen
from modules.dexterity.view import DexterityScreen
from modules.dexterity.voxscope_screen import VoxScopeScreen
from modules.deecadence.view import DeeCadenceScreen
from modules.onboarding.view import OnboardingScreen

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
                font_dir, "NotoSans-Bold.ttf")
        )
        return "AppFont"
    except Exception:
        return "Roboto"


class TheSystemApp(MDApp):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.db = Database()
        self.title = "DEE_CISTEM"
        self.user_name = "DC"
        self.onboarding_complete = False
        self.font_name = _load_font()
        self.pending_txn_type = "expense"
        self.gate = None

    def build(self):
        self.theme_cls.theme_style = "Dark"
        self.theme_cls.primary_palette = "Blue"
        self.db.initialize()
        self._load_settings()

        # Initialise subscription gate
        self.gate = SubscriptionGate(self.db)

        sm = ScreenManager(
            transition=FadeTransition(duration=0.12))

        sm.add_widget(
            OnboardingScreen(name="onboarding"))
        sm.add_widget(
            NavigationScreen(name="navigation"))
        sm.add_widget(
            DashboardScreen(name="dashboard"))
        sm.add_widget(
            FinancialScreen(name="financial"))
        sm.add_widget(
            AddTransactionScreen(
                name="add_transaction"))
        sm.add_widget(
            TransactionHistoryScreen(
                name="transaction_history"))
        sm.add_widget(SpiritScreen(name="spirit"))
        sm.add_widget(EnergyScreen(name="energy"))
        sm.add_widget(MindScreen(name="mind"))
        sm.add_widget(
            KnowledgeScreen(name="knowledge"))
        sm.add_widget(
            DexterityScreen(name="dexterity"))
        sm.add_widget(
            VoxScopeScreen(name="voxscope"))
        sm.add_widget(
            DeeCadenceScreen(name="deecadence"))
        sm.add_widget(
            UpgradeScreen(name="upgrade"))
        sm.add_widget(
            LockedModuleScreen(name="locked_module"))

        if self.onboarding_complete:
            sm.current = "navigation"
        else:
            sm.current = "onboarding"

        return sm

    def navigate_to_module(self, module_key, sm):
        """
        Central navigation method.
        Checks subscription gate before routing.
        """
        if self.gate.can_access_module(module_key):
            sm.current = module_key
        else:
            locked = sm.get_screen("locked_module")
            locked.set_module(module_key)
            sm.current = "locked_module"

    def _load_settings(self):
        try:
            rows = self.db.fetchall(
                "SELECT key, value FROM app_settings")
            settings = {r["key"]: r["value"]
                        for r in rows}
            self.user_name = settings.get(
                "user_name", "DC")
            self.onboarding_complete = (
                settings.get(
                    "onboarding_complete",
                    "0") == "1")
        except Exception:
            pass

    def on_stop(self):
        self.db.close()


if __name__ == "__main__":
    TheSystemApp().run()

