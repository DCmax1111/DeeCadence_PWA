from kivymd.app import MDApp
from kivy.uix.screenmanager import ScreenManager, FadeTransition
from kivy.core.window import Window
from kivy.core.text import LabelBase
from kivy.clock import Clock
from core.database import Database
from screens.navigation import NavigationScreen
from screens.dashboard import DashboardScreen
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

Window.softinput_mode = "below_target"

# ── Register fonts ────────────────────────────────────────────────
import os

FONT_DIR = os.path.join(
    os.path.dirname(__file__), "assets", "fonts")

# Fallback — use Roboto from KivyMD if custom fonts not present
try:
    LabelBase.register(
        name="AppFont",
        fn_regular=os.path.join(FONT_DIR, "NotoSans-Regular.ttf"),
        fn_bold=os.path.join(FONT_DIR, "NotoSans-Bold.ttf")
    )
    APP_FONT = "AppFont"
except Exception:
    APP_FONT = "Roboto"


class TheSystemApp(MDApp):
    font_name = APP_FONT

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.db = Database()
        self.title = "DEE_CISTEM"
        self.user_name = "DC"  # Will come from settings later

    def build(self):
        self.theme_cls.theme_style = "Dark"
        self.theme_cls.primary_palette = "Blue"
        self.db.initialize()

        sm = ScreenManager(
            transition=FadeTransition(duration=0.15))
        sm.add_widget(NavigationScreen(name="navigation"))
        sm.add_widget(DashboardScreen(name="dashboard"))
        sm.add_widget(FinancialScreen(name="financial"))
        sm.add_widget(AddTransactionScreen(
            name="add_transaction"))
        sm.add_widget(TransactionHistoryScreen(
            name="transaction_history"))
        sm.add_widget(SpiritScreen(name="spirit"))
        sm.add_widget(EnergyScreen(name="energy"))
        sm.add_widget(MindScreen(name="mind"))
        sm.add_widget(KnowledgeScreen(name="knowledge"))
        sm.add_widget(DexterityScreen(name="dexterity"))
        sm.add_widget(VoxScopeScreen(name="voxscope"))
        sm.add_widget(DeeCadenceScreen(name="deecadence"))
        return sm

    def on_stop(self):
        self.db.close()


if __name__ == "__main__":
    TheSystemApp().run()
