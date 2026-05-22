from kivy.core.window import Window
from kivy.uix.screenmanager import FadeTransition, ScreenManager
from kivymd.app import MDApp

from app.screens.home import HomeScreen


Window.softinput_mode = "below_target"


class DeeCadenceApp(MDApp):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.title = "DeeCadence"
        self.user_name = "DC"

    def build(self):
        self.theme_cls.theme_style = "Dark"
        self.theme_cls.primary_palette = "Blue"

        manager = ScreenManager(transition=FadeTransition(duration=0.12))
        manager.add_widget(HomeScreen(name="home"))
        manager.current = "home"
        return manager


if __name__ == "__main__":
    DeeCadenceApp().run()

